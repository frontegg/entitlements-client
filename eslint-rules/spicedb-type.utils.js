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
	if (!type || related.has(type)) {
		return false;
	}
	if (depth > RELATED_TYPE_DEPTH) {
		return true;
	}
	related.add(type);

	let isTruncated = false;
	for (const group of [type.types, type.aliasTypeArguments, type.typeArguments]) {
		for (const member of group ?? []) {
			isTruncated = collectRelatedTypes(member, depth + 1, related) || isTruncated;
		}
	}

	return isTruncated;
}

function relatedTypes(type) {
	const related = new Set();
	const isTruncated = collectRelatedTypes(type, 0, related);

	return { candidates: [...related], isTruncated };
}

function isSpiceDBType(type) {
	const { candidates, isTruncated } = relatedTypes(type);

	return (
		candidates.some(
			(candidate) => isDeclaredBySpiceDB(candidate.aliasSymbol) || isDeclaredBySpiceDB(candidate.getSymbol())
		) || isTruncated
	);
}

function resolvesToSpiceDBField(checker, type, path) {
	const [name, ...rest] = path;
	const { candidates, isTruncated } = relatedTypes(type);

	return (
		candidates.some((candidate) => {
			const property = checker.getPropertyOfType(candidate, name);
			if (!property) {
				return false;
			}

			return rest.length === 0
				? isDeclaredBySpiceDB(property)
				: resolvesToSpiceDBField(checker, checker.getTypeOfSymbol(property), rest);
		}) || isTruncated
	);
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
