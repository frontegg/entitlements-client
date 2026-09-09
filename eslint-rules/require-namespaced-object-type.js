const OBJECT_TYPE_FIELDS = new Set(['objectType', 'resourceObjectType', 'subjectObjectType', 'resourceType']);

const SPICEDB_TYPE_SOURCE = '@authzed/authzed-node';

function isNamespaceTypeCall(node) {
	return (
		node.type === 'CallExpression' &&
		node.callee.type === 'MemberExpression' &&
		!node.callee.computed &&
		node.callee.property.type === 'Identifier' &&
		node.callee.property.name === 'type'
	);
}

function relatedTypes(type, depth = 0, seen = []) {
	if (!type || depth > 4 || seen.includes(type)) {
		return seen;
	}
	seen.push(type);

	for (const group of [type.types, type.aliasTypeArguments, type.typeArguments]) {
		if (Array.isArray(group)) {
			for (const member of group) {
				relatedTypes(member, depth + 1, seen);
			}
		}
	}

	return seen;
}

function declaredBySpiceDB(checker, tsNode) {
	const type = checker.getContextualType(tsNode);
	if (!type) {
		return false;
	}

	return relatedTypes(type).some((candidate) => {
		const symbol = candidate.aliasSymbol ?? candidate.symbol;
		const declarations = symbol?.getDeclarations?.() ?? [];
		return declarations.some((declaration) =>
			declaration.getSourceFile().fileName.includes(SPICEDB_TYPE_SOURCE)
		);
	});
}

module.exports = {
	meta: {
		type: 'problem',
		docs: {
			description:
				'SpiceDB request object types must be built through SchemaNamespace.type() so every read is namespaced to one instance'
		},
		schema: [],
		messages: {
			unnamespaced:
				"'{{field}}' is a SpiceDB request field and must be built with namespace.type(...). " +
				'An un-namespaced object type reads across every configured instance.'
		}
	},

	create(context) {
		const services = context.sourceCode.parserServices;
		if (!services?.program || !services.esTreeNodeToTSNodeMap) {
			return {};
		}
		const checker = services.program.getTypeChecker();

		return {
			Property(node) {
				if (node.computed || node.key.type !== 'Identifier' || !OBJECT_TYPE_FIELDS.has(node.key.name)) {
					return;
				}
				if (node.parent?.type !== 'ObjectExpression') {
					return;
				}
				if (isNamespaceTypeCall(node.value)) {
					return;
				}

				const tsNode = services.esTreeNodeToTSNodeMap.get(node.parent);
				if (!tsNode || !declaredBySpiceDB(checker, tsNode)) {
					return;
				}

				context.report({ node, messageId: 'unnamespaced', data: { field: node.key.name } });
			}
		};
	}
};
