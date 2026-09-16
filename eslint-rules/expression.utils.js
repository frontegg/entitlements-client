const { FUNCTION_TYPES, TRANSPARENT_EXPRESSION_TYPES } = require('./require-namespaced-object-type.consts');

function unwrapExpression(node) {
	let current = node;
	while (TRANSPARENT_EXPRESSION_TYPES.has(current.type)) {
		current = current.expression;
	}

	return current;
}

function staticPropertyName(key, isComputed) {
	if (key.type === 'Literal' && typeof key.value === 'string') {
		return key.value;
	}

	return !isComputed && key.type === 'Identifier' ? key.name : undefined;
}

function findVariable(scope, name) {
	for (let current = scope; current; current = current.upper) {
		const variable = current.set.get(name);
		if (variable) {
			return variable;
		}
	}

	return undefined;
}

function constantInitializer(sourceCode, identifier) {
	const variable = findVariable(sourceCode.getScope(identifier), identifier.name);
	const definition = variable?.defs.length === 1 ? variable.defs[0] : undefined;
	if (definition?.type !== 'Variable' || definition.parent.kind !== 'const' || !definition.node.init) {
		return undefined;
	}

	const isDeclaredBeforeUse = definition.node.range[1] <= identifier.range[0];

	return isDeclaredBeforeUse ? definition.node.init : undefined;
}

function enclosingFunction(node) {
	for (let current = node.parent; current; current = current.parent) {
		if (FUNCTION_TYPES.has(current.type)) {
			return current;
		}
	}

	return undefined;
}

module.exports = {
	unwrapExpression,
	staticPropertyName,
	constantInitializer,
	enclosingFunction
};
