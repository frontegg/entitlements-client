const {
	FUNCTION_TYPES,
	TRANSPARENT_EXPRESSION_TYPES,
	UNRESOLVABLE_STEP,
	UNRESOLVED_SELECTION
} = require('./require-namespaced-object-type.consts');

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

function soleVariableDefinition(sourceCode, identifier) {
	const variable = findVariable(sourceCode.getScope(identifier), identifier.name);
	const definition = variable?.defs.length === 1 ? variable.defs[0] : undefined;

	return definition?.type === 'Variable' && definition.node.init ? definition : undefined;
}

function patternStep(pattern, parent) {
	if (parent.type === 'Property') {
		const key = staticPropertyName(parent.key, parent.computed);
		return key === undefined ? UNRESOLVABLE_STEP : { key };
	}

	return parent.type === 'ArrayPattern' ? { index: parent.elements.indexOf(pattern) } : undefined;
}

function bindingSources(definition) {
	const defaults = [];
	let steps = [];
	for (let pattern = definition.name; pattern !== definition.node.id; pattern = pattern.parent) {
		const parent = pattern.parent;
		if (parent.type === 'RestElement') {
			steps = [UNRESOLVABLE_STEP, ...steps];
			pattern = parent;
			continue;
		}
		if (parent.type === 'AssignmentPattern') {
			defaults.push({ expression: parent.right, steps });
			continue;
		}

		const step = patternStep(pattern, parent);
		if (step !== undefined) {
			steps = [step, ...steps];
		}
	}

	return [{ expression: definition.node.init, steps }, ...defaults];
}

function variableSources(sourceCode, identifier) {
	const definition = soleVariableDefinition(sourceCode, identifier);

	return definition === undefined ? undefined : bindingSources(definition);
}

function constantSources(sourceCode, identifier) {
	const definition = soleVariableDefinition(sourceCode, identifier);
	if (definition === undefined || definition.parent.kind !== 'const') {
		return undefined;
	}

	const isDeclaredBeforeUse = definition.node.range[1] <= identifier.range[0];

	return isDeclaredBeforeUse ? bindingSources(definition) : undefined;
}

function mergeSelections(selections) {
	return {
		values: selections.flatMap(({ values }) => values),
		isExact: selections.every(({ isExact }) => isExact)
	};
}

function boundValues(identifier, sourcesOf, steps = []) {
	const sources = sourcesOf(identifier);

	return sources === undefined
		? UNRESOLVED_SELECTION
		: mergeSelections(
				sources.map((source) => selectedValues(source.expression, [...source.steps, ...steps], sourcesOf))
			);
}

function selectedValues(node, steps, sourcesOf) {
	if (steps.length === 0) {
		return { values: [node], isExact: true };
	}

	const value = unwrapExpression(node);
	switch (value.type) {
		case 'Identifier':
			return boundValues(value, sourcesOf, steps);
		case 'ConditionalExpression':
			return mergeSelections([
				selectedValues(value.consequent, steps, sourcesOf),
				selectedValues(value.alternate, steps, sourcesOf)
			]);
		case 'LogicalExpression':
			return mergeSelections([
				selectedValues(value.left, steps, sourcesOf),
				selectedValues(value.right, steps, sourcesOf)
			]);
		case 'ObjectExpression':
			return selectedMembers(value, steps, sourcesOf);
		case 'ArrayExpression':
			return selectedElements(value, steps, sourcesOf);
		default:
			return UNRESOLVED_SELECTION;
	}
}

function selectedMembers(object, steps, sourcesOf) {
	const [step, ...rest] = steps;
	const isUnresolvable = step === UNRESOLVABLE_STEP;
	if (!isUnresolvable && step.key === undefined) {
		return UNRESOLVED_SELECTION;
	}

	const selections = isUnresolvable ? [UNRESOLVED_SELECTION, selectedValues(object, rest, sourcesOf)] : [];
	for (const member of object.properties) {
		if (member.type === 'SpreadElement') {
			selections.push(selectedValues(member.argument, steps, sourcesOf));
			continue;
		}

		const name = staticPropertyName(member.key, member.computed);
		if (isUnresolvable || name === undefined) {
			selections.push(UNRESOLVED_SELECTION, selectedValues(member.value, rest, sourcesOf));
		} else if (name === step.key) {
			selections.push(selectedValues(member.value, rest, sourcesOf));
		}
	}

	return mergeSelections(selections);
}

function selectedElements(array, steps, sourcesOf) {
	const [step, ...rest] = steps;
	if (step.index === undefined) {
		return mergeSelections([
			UNRESOLVED_SELECTION,
			selectedValues(array, rest, sourcesOf),
			...array.elements.map((element) =>
				element === null
					? UNRESOLVED_SELECTION
					: element.type === 'SpreadElement'
						? selectedValues(element.argument, steps, sourcesOf)
						: selectedValues(element, rest, sourcesOf)
			)
		]);
	}

	const selections = [];
	let isPositionKnown = true;
	for (const [position, element] of array.elements.entries()) {
		if (isPositionKnown && position > step.index) {
			break;
		}
		if (element === null) {
			continue;
		}
		if (element.type === 'SpreadElement') {
			selections.push(
				UNRESOLVED_SELECTION,
				selectedValues(element.argument, [UNRESOLVABLE_STEP, ...rest], sourcesOf)
			);
			isPositionKnown = false;
		} else if (!isPositionKnown || position === step.index) {
			selections.push(selectedValues(element, rest, sourcesOf));
		}
	}

	return mergeSelections(selections);
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
	constantSources,
	variableSources,
	boundValues,
	enclosingFunction
};
