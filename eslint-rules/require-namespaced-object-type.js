const {
	ARRAY_FACTORY,
	LIST_MAPPING_METHODS,
	OBJECT_TYPE_FIELDS,
	OBJECT_TYPE_LIST_FIELDS,
	TRANSPARENT_EXPRESSION_TYPES
} = require('./require-namespaced-object-type.consts');
const { MissingTypeInformationError } = require('./missing-type-information.error');
const { isGenericCall, isSchemaNamespaceType, isSpiceDBType, resolvesToSpiceDBField } = require('./spicedb-type.utils');
const { constantInitializer, enclosingFunction, staticPropertyName, unwrapExpression } = require('./expression.utils');

module.exports = {
	meta: {
		type: 'problem',
		docs: {
			description:
				'SpiceDB message object types must be built through SchemaNamespace.type() so every read is namespaced to one instance'
		},
		schema: [],
		messages: {
			unnamespaced:
				"'{{field}}' is a SpiceDB message field and must be built with namespace.type(...). " +
				'An un-namespaced object type reads across every configured instance.'
		}
	},

	create(context) {
		const { sourceCode } = context;
		const services = sourceCode.parserServices;
		if (!services?.program || !services.esTreeNodeToTSNodeMap) {
			throw new MissingTypeInformationError(context.filename);
		}
		const checker = services.program.getTypeChecker();
		const reported = new Set();

		function tsNodeOf(node) {
			return services.esTreeNodeToTSNodeMap.get(node);
		}

		function report(node, field) {
			if (reported.has(node)) {
				return;
			}
			reported.add(node);
			context.report({ node, messageId: 'unnamespaced', data: { field } });
		}

		function isSchemaNamespaceTypeCall(node) {
			return (
				node.type === 'CallExpression' &&
				node.callee.type === 'MemberExpression' &&
				staticPropertyName(node.callee.property, node.callee.computed) === 'type' &&
				isSchemaNamespaceType(checker, checker.getTypeAtLocation(tsNodeOf(node.callee.object)))
			);
		}

		function everyValueBranch(node, isAccepted) {
			const value = unwrapExpression(node);
			if (value.type === 'ConditionalExpression') {
				return everyValueBranch(value.consequent, isAccepted) && everyValueBranch(value.alternate, isAccepted);
			}
			if (value.type === 'LogicalExpression') {
				return everyValueBranch(value.left, isAccepted) && everyValueBranch(value.right, isAccepted);
			}
			if (value.type === 'Identifier') {
				const initializer = constantInitializer(sourceCode, value);
				return initializer !== undefined && everyValueBranch(initializer, isAccepted);
			}

			return isAccepted(value);
		}

		function isNamespacedValue(node) {
			return everyValueBranch(node, isSchemaNamespaceTypeCall);
		}

		function mappingCallback(node) {
			if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression') {
				return undefined;
			}

			const method = staticPropertyName(node.callee.property, node.callee.computed);
			const receiver = unwrapExpression(node.callee.object);
			if (
				receiver.type === 'Identifier' &&
				receiver.name === ARRAY_FACTORY.object &&
				method === ARRAY_FACTORY.method
			) {
				return node.arguments[ARRAY_FACTORY.callbackIndex];
			}

			return LIST_MAPPING_METHODS.has(method) ? node.arguments[0] : undefined;
		}

		function returnedExpression(callback) {
			if (callback?.type !== 'ArrowFunctionExpression') {
				return undefined;
			}
			if (callback.body.type !== 'BlockStatement') {
				return callback.body;
			}

			const [statement] = callback.body.body;

			return callback.body.body.length === 1 && statement.type === 'ReturnStatement'
				? statement.argument ?? undefined
				: undefined;
		}

		function isNamespacedMapping(node) {
			const returned = returnedExpression(mappingCallback(node));

			return returned !== undefined && (isNamespacedValue(returned) || isNamespacedListLiteral(returned));
		}

		function isNamespacedListLiteral(node) {
			if (node.type !== 'ArrayExpression') {
				return isNamespacedMapping(node);
			}

			return node.elements.every(
				(element) =>
					element !== null &&
					(element.type === 'SpreadElement' ? isNamespacedList(element.argument) : isNamespacedValue(element))
			);
		}

		function isNamespacedList(node) {
			return everyValueBranch(node, isNamespacedListLiteral);
		}

		function isNamespacedField(field, node) {
			return OBJECT_TYPE_LIST_FIELDS.has(field) ? isNamespacedList(node) : isNamespacedValue(node);
		}

		function callArgumentStep(argument, path) {
			const call = argument.parent;
			const isGenericCallArgument =
				call?.type === 'CallExpression' &&
				call.arguments.includes(argument) &&
				isGenericCall(checker, tsNodeOf(call));

			return isGenericCallArgument ? { expression: call, path } : undefined;
		}

		function enclosingStep({ expression, path }) {
			const parent = expression.parent;
			if (TRANSPARENT_EXPRESSION_TYPES.has(parent?.type)) {
				return { expression: parent, path };
			}

			switch (parent?.type) {
				case 'Property': {
					const name =
						parent.value === expression && parent.parent.type === 'ObjectExpression'
							? staticPropertyName(parent.key, parent.computed)
							: undefined;
					return name === undefined ? undefined : { expression: parent.parent, path: [name, ...path] };
				}
				case 'SpreadElement':
					return ['ObjectExpression', 'ArrayExpression'].includes(parent.parent.type)
						? { expression: parent.parent, path }
						: undefined;
				case 'ConditionalExpression':
					return parent.test === expression ? undefined : { expression: parent, path };
				case 'ArrayExpression':
				case 'LogicalExpression':
				case 'AwaitExpression':
					return { expression: parent, path };
				case 'ArrowFunctionExpression':
					return parent.body === expression ? callArgumentStep(parent, path) : undefined;
				case 'ReturnStatement': {
					const returningFunction = enclosingFunction(parent);
					return returningFunction ? callArgumentStep(returningFunction, path) : undefined;
				}
				case 'CallExpression':
					return callArgumentStep(expression, path);
				default:
					return undefined;
			}
		}

		function isSpiceDBFieldInContext(expression, field) {
			for (let step = { expression, path: [field] }; step; step = enclosingStep(step)) {
				const contextualType = checker.getContextualType(tsNodeOf(step.expression));
				if (contextualType && resolvesToSpiceDBField(checker, contextualType, step.path)) {
					return true;
				}
			}

			return false;
		}

		function checkAgainstType(node, expectedType, path) {
			const value = unwrapExpression(node);
			switch (value.type) {
				case 'Identifier': {
					const initializer = constantInitializer(sourceCode, value);
					if (initializer) {
						checkAgainstType(initializer, expectedType, path);
					}
					return;
				}
				case 'ConditionalExpression':
					checkAgainstType(value.consequent, expectedType, path);
					checkAgainstType(value.alternate, expectedType, path);
					return;
				case 'ArrayExpression':
					for (const element of value.elements) {
						if (element) {
							checkAgainstType(
								element.type === 'SpreadElement' ? element.argument : element,
								expectedType,
								path
							);
						}
					}
					return;
				case 'ObjectExpression':
					checkObjectAgainstType(value, expectedType, path);
					return;
				default:
					return;
			}
		}

		function checkObjectAgainstType(node, expectedType, path) {
			for (const member of node.properties) {
				if (member.type === 'SpreadElement') {
					checkAgainstType(member.argument, expectedType, path);
					continue;
				}

				const name = staticPropertyName(member.key, member.computed);
				if (name === undefined) {
					continue;
				}

				const memberPath = [...path, name];
				if (OBJECT_TYPE_FIELDS.has(name) && resolvesToSpiceDBField(checker, expectedType, memberPath)) {
					if (!isNamespacedField(name, member.value)) {
						report(member, name);
					}
					continue;
				}

				checkAgainstType(member.value, expectedType, memberPath);
			}
		}

		return {
			Property(node) {
				const field = staticPropertyName(node.key, node.computed);
				if (!OBJECT_TYPE_FIELDS.has(field) || node.parent.type !== 'ObjectExpression') {
					return;
				}
				if (isNamespacedField(field, node.value)) {
					return;
				}
				if (isSpiceDBFieldInContext(node.parent, field)) {
					report(node, field);
				}
			},

			CallExpression(node) {
				if (node.callee.type !== 'MemberExpression' || node.arguments.length === 0) {
					return;
				}
				if (!isSpiceDBType(checker.getTypeAtLocation(tsNodeOf(node.callee.object)))) {
					return;
				}

				for (const argument of node.arguments) {
					const expectedType =
						argument.type === 'SpreadElement' ? undefined : checker.getContextualType(tsNodeOf(argument));
					if (expectedType) {
						checkAgainstType(argument, expectedType, []);
					}
				}
			},

			'TSAsExpression, TSTypeAssertion'(node) {
				const assertedType = checker.getTypeAtLocation(tsNodeOf(node));
				if (isSpiceDBType(assertedType)) {
					checkAgainstType(node.expression, assertedType, []);
				}
			},

			AssignmentExpression(node) {
				if (node.left.type !== 'MemberExpression') {
					return;
				}

				const field = staticPropertyName(node.left.property, node.left.computed);
				if (!OBJECT_TYPE_FIELDS.has(field) || isNamespacedField(field, node.right)) {
					return;
				}
				if (resolvesToSpiceDBField(checker, checker.getTypeAtLocation(tsNodeOf(node.left.object)), [field])) {
					report(node, field);
				}
			}
		};
	}
};
