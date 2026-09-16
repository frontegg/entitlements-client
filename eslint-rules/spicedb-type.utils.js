const {
	RELATED_TYPE_DEPTH,
	SCHEMA_NAMESPACE_SOURCE,
	SPICEDB_TYPE_SOURCE
} = require('./require-namespaced-object-type.consts');

function isDeclaredIn(symbol, matchesFileName) {
	return (symbol?.declarations ?? []).some((declaration) =>
		matchesFileName(declaration.getSourceFile().fileName.split('\\').join('/'))
	);
}

function isDeclaredBySpiceDB(symbol) {
	return isDeclaredIn(symbol, (fileName) => fileName.includes(SPICEDB_TYPE_SOURCE));
}

function collectRelatedTypes(type, depth, related) {
	if (!type || depth > RELATED_TYPE_DEPTH || related.has(type)) {
		return related;
	}
	related.add(type);

	for (const group of [type.types, type.aliasTypeArguments, type.typeArguments]) {
		for (const member of group ?? []) {
			collectRelatedTypes(member, depth + 1, related);
		}
	}

	return related;
}

function relatedTypes(type) {
	return [...collectRelatedTypes(type, 0, new Set())];
}

function isSpiceDBType(type) {
	return relatedTypes(type).some(
		(candidate) => isDeclaredBySpiceDB(candidate.aliasSymbol) || isDeclaredBySpiceDB(candidate.getSymbol())
	);
}

function resolvesToSpiceDBField(checker, type, path) {
	const [name, ...rest] = path;

	return relatedTypes(type).some((candidate) => {
		const property = checker.getPropertyOfType(candidate, name);
		if (!property) {
			return false;
		}

		return rest.length === 0
			? isDeclaredBySpiceDB(property)
			: resolvesToSpiceDBField(checker, checker.getTypeOfSymbol(property), rest);
	});
}

function isSchemaNamespaceType(checker, type) {
	return isDeclaredIn(checker.getNonNullableType(type).getSymbol(), (fileName) =>
		fileName.endsWith(SCHEMA_NAMESPACE_SOURCE)
	);
}

function isGenericCall(checker, tsCall) {
	const declaration = checker.getResolvedSignature(tsCall)?.getDeclaration();

	return (declaration?.typeParameters?.length ?? 0) > 0;
}

module.exports = {
	isSpiceDBType,
	resolvesToSpiceDBField,
	isSchemaNamespaceType,
	isGenericCall
};
