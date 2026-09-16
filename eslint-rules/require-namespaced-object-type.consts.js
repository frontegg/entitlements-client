const OBJECT_TYPE_FIELDS = new Set([
	'objectType',
	'resourceObjectType',
	'subjectObjectType',
	'resourceType',
	'subjectType',
	'optionalObjectTypes'
]);

const OBJECT_TYPE_LIST_FIELDS = new Set(['optionalObjectTypes']);

const SPICEDB_TYPE_SOURCE = '/node_modules/@authzed/authzed-node/';

const SCHEMA_NAMESPACE_SOURCE = '/src/instances/schema-namespace.ts';

const RELATED_TYPE_DEPTH = 4;

const TRANSPARENT_EXPRESSION_TYPES = new Set([
	'ChainExpression',
	'TSAsExpression',
	'TSNonNullExpression',
	'TSSatisfiesExpression',
	'TSTypeAssertion'
]);

const FUNCTION_TYPES = new Set(['ArrowFunctionExpression', 'FunctionExpression', 'FunctionDeclaration']);

module.exports = {
	OBJECT_TYPE_FIELDS,
	OBJECT_TYPE_LIST_FIELDS,
	SPICEDB_TYPE_SOURCE,
	SCHEMA_NAMESPACE_SOURCE,
	RELATED_TYPE_DEPTH,
	TRANSPARENT_EXPRESSION_TYPES,
	FUNCTION_TYPES
};
