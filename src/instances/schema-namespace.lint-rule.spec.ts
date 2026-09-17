import { MissingTypeInformationError } from '../../eslint-rules/missing-type-information.error';
import {
	lintWithoutTypeInformation,
	runRequireNamespacedObjectType
} from '../../eslint-rules/require-namespaced-object-type.spec-helper';

const PREAMBLE = [
	"import { v1 } from '@authzed/authzed-node';",
	"import { SchemaNamespace } from '../../src/instances/schema-namespace';",
	'declare const namespace: SchemaNamespace;',
	'declare const optionalNamespace: SchemaNamespace | undefined;',
	'declare const client: v1.ZedPromiseClientInterface;',
	'declare const documentIds: string[];',
	'declare const isUser: boolean;'
];

function source(...lines: string[]): string {
	return [...PREAMBLE, ...lines].join('\n');
}

function unnamespaced(...fields: string[]): { messageId: string; data: { field: string } }[] {
	return fields.map((field) => ({ messageId: 'unnamespaced', data: { field } }));
}

runRequireNamespacedObjectType({
	valid: [
		{
			name: 'a direct object type built with namespace.type',
			code: source("v1.ObjectReference.create({ objectType: namespace.type('document'), objectId: '1' });")
		},
		{
			name: 'a shorthand object type bound to namespace.type',
			code: source(
				"const objectType = namespace.type('document');",
				"v1.ObjectReference.create({ objectType, objectId: '1' });"
			)
		},
		{
			name: 'a spread that leaves the object type namespaced',
			code: source(
				"const identity = { objectId: '1' };",
				"v1.ObjectReference.create({ ...identity, objectType: namespace.type('document') });"
			)
		},
		{
			name: 'object types returned from a map callback',
			code: source(
				'const references: v1.ObjectReference[] = documentIds.map((objectId) => ({',
				"	objectType: namespace.type('document'),",
				'	objectId',
				'}));'
			)
		},
		{
			name: 'an object type resolved through Promise.resolve',
			code: source(
				'const reference: Promise<v1.ObjectReference> = Promise.resolve({',
				"	objectType: namespace.type('document'),",
				"	objectId: '1'",
				'});'
			)
		},
		{
			name: 'a check permission resource and subject object',
			code: source(
				'v1.CheckPermissionRequest.create({',
				"	resource: { objectType: namespace.type('document'), objectId: '1' },",
				"	permission: 'view',",
				"	subject: { object: { objectType: namespace.type('user'), objectId: '2' }, optionalRelation: '' }",
				'});'
			)
		},
		{
			name: 'lookup resource and subject object types',
			code: source(
				"v1.LookupResourcesRequest.create({ resourceObjectType: namespace.type('document'), permission: 'view' });",
				"v1.LookupSubjectsRequest.create({ subjectObjectType: namespace.type('user'), permission: 'view' });"
			)
		},
		{
			name: 'bulk items returned from a flatMap callback',
			code: source(
				'v1.CheckBulkPermissionsRequest.create({',
				'	items: documentIds.flatMap((objectId) => [',
				"		{ resource: { objectType: namespace.type('document'), objectId }, permission: 'view' }",
				'	])',
				'});'
			)
		},
		{
			name: 'relationship and subject filter types',
			code: source(
				'v1.ReadRelationshipsRequest.create({',
				'	relationshipFilter: {',
				"		resourceType: namespace.type('document'),",
				"		optionalSubjectFilter: { subjectType: namespace.type('user') }",
				'	}',
				'});'
			)
		},
		{
			name: 'watch object types listed and mapped through namespace.type',
			code: source(
				'v1.WatchRequest.create({',
				"	optionalObjectTypes: [namespace.type('document'), ...documentIds.map((type) => namespace.type(type))]",
				'});'
			)
		},
		{
			name: 'namespace.type behind optional chaining, a non-null assertion and a type assertion',
			code: source(
				'v1.ObjectReference.create({',
				"	objectType: optionalNamespace?.type('document') ?? namespace.type('document'),",
				"	objectId: '1'",
				'});',
				"v1.ObjectReference.create({ objectType: optionalNamespace!.type('document') as string, objectId: '2' });"
			)
		},
		{
			name: 'a conditional whose branches are both namespaced',
			code: source(
				'v1.ObjectReference.create({',
				"	objectType: isUser ? namespace.type('user') : namespace.type('tenant'),",
				"	objectId: '1'",
				'});'
			)
		},
		{
			name: 'a namespaced member assignment',
			code: source(
				'const reference = v1.ObjectReference.create();',
				"reference.objectType = namespace.type('document');"
			)
		},
		{
			name: 'an object type field on a log entry that is not a SpiceDB message',
			code: source(
				'function logRequest<TRequest>(request: TRequest): TRequest {',
				'	return request;',
				'}',
				"logRequest({ action: 'SpiceDB:checkPermission:request', objectType: 'document' });"
			)
		},
		{
			name: 'an object type read back through destructuring',
			code: source('const { objectType } = v1.ObjectReference.create();', 'export { objectType };')
		},
		{
			name: 'a raw object type handed to a non-generic helper that namespaces it',
			code: source(
				'function toReference(reference: { objectType: string; objectId: string }): v1.ObjectReference {',
				'	return { objectType: namespace.type(reference.objectType), objectId: reference.objectId };',
				'}',
				"v1.CheckPermissionRequest.create({ resource: toReference({ objectType: 'document', objectId: '1' }) });"
			)
		},
		{
			name: 'an object type key inside a caveat context',
			code: source(
				"v1.CheckPermissionRequest.create({ context: v1.PbStruct.fromJson({ objectType: 'document' }) });"
			)
		}
	],
	invalid: [
		{
			name: 'a raw string object type',
			code: source("v1.ObjectReference.create({ objectType: 'document', objectId: '1' });"),
			errors: unnamespaced('objectType')
		},
		{
			name: 'a shorthand object type bound to a raw string',
			code: source("const objectType = 'document';", "v1.ObjectReference.create({ objectType, objectId: '1' });"),
			errors: unnamespaced('objectType')
		},
		{
			name: 'a template literal object type',
			code: source("v1.ObjectReference.create({ objectType: `document`, objectId: '1' });"),
			errors: unnamespaced('objectType')
		},
		{
			name: 'raw object types spread into a message',
			code: source(
				"const documentType = { objectType: 'document' };",
				"v1.ObjectReference.create({ ...documentType, objectId: '1' });",
				"v1.ObjectReference.create({ ...{ objectType: 'folder' }, objectId: '2' });"
			),
			errors: unnamespaced('objectType', 'objectType')
		},
		{
			name: 'a raw object type returned from a map callback',
			code: source(
				"const references: v1.ObjectReference[] = documentIds.map((objectId) => ({ objectType: 'document', objectId }));"
			),
			errors: unnamespaced('objectType')
		},
		{
			name: 'raw bulk items returned from a flatMap block',
			code: source(
				'v1.CheckBulkPermissionsRequest.create({',
				'	items: documentIds.flatMap((objectId) => {',
				"		return [{ resource: { objectType: 'document', objectId }, permission: 'view' }];",
				'	})',
				'});'
			),
			errors: unnamespaced('objectType')
		},
		{
			name: 'a raw object type resolved through Promise.resolve',
			code: source(
				"const reference: Promise<v1.ObjectReference> = Promise.resolve({ objectType: 'document', objectId: '1' });"
			),
			errors: unnamespaced('objectType')
		},
		{
			name: 'type() on a receiver that is not a SchemaNamespace',
			code: source(
				'const lookalike = { type: (objectType: string): string => objectType };',
				"v1.ObjectReference.create({ objectType: lookalike.type('document'), objectId: '1' });"
			),
			errors: unnamespaced('objectType')
		},
		{
			name: 'an unannotated request variable passed to create',
			code: source(
				"const reference = { objectType: 'document', objectId: '1' };",
				'const request = {',
				'	resource: reference,',
				"	permission: 'view',",
				"	subject: { object: { objectType: 'user', objectId: '2' }, optionalRelation: '' }",
				'};',
				'client.checkPermission(v1.CheckPermissionRequest.create(request));'
			),
			errors: unnamespaced('objectType', 'objectType')
		},
		{
			name: 'an unannotated request variable passed to the client',
			code: source(
				'const request = {',
				"	relationshipFilter: { resourceType: 'document', optionalResourceId: '', optionalResourceIdPrefix: '', optionalRelation: '' },",
				'	optionalLimit: 0',
				'};',
				'client.readRelationships(request);'
			),
			errors: unnamespaced('resourceType')
		},
		{
			name: 'a raw member assignment',
			code: source('const reference = v1.ObjectReference.create();', "reference.objectType = 'document';"),
			errors: unnamespaced('objectType')
		},
		{
			name: 'raw object types hidden behind as unknown as',
			code: source(
				"const reference = { objectType: 'document', objectId: '1' };",
				'export const casted = reference as unknown as v1.ObjectReference;',
				"export const inline = { objectType: 'folder', objectId: '2' } as unknown as v1.ObjectReference;"
			),
			errors: unnamespaced('objectType', 'objectType')
		},
		{
			name: 'a raw check permission subject object',
			code: source(
				'v1.CheckPermissionRequest.create({',
				"	resource: { objectType: namespace.type('document'), objectId: '1' },",
				"	permission: 'view',",
				"	subject: { object: { objectType: 'user', objectId: '2' }, optionalRelation: '' }",
				'});'
			),
			errors: unnamespaced('objectType')
		},
		{
			name: 'raw lookup resource and subject object types',
			code: source(
				"v1.LookupResourcesRequest.create({ resourceObjectType: 'document', permission: 'view' });",
				"v1.LookupSubjectsRequest.create({ subjectObjectType: 'user', permission: 'view' });"
			),
			errors: unnamespaced('resourceObjectType', 'subjectObjectType')
		},
		{
			name: 'a raw bulk item resource',
			code: source(
				'v1.CheckBulkPermissionsRequest.create({',
				'	items: [',
				'		{',
				"			resource: { objectType: 'document', objectId: '1' },",
				"			permission: 'view',",
				"			subject: { object: { objectType: namespace.type('user'), objectId: '2' }, optionalRelation: '' }",
				'		}',
				'	]',
				'});'
			),
			errors: unnamespaced('objectType')
		},
		{
			name: 'raw relationship and subject filter types',
			code: source(
				'v1.ReadRelationshipsRequest.create({',
				"	relationshipFilter: { resourceType: 'document', optionalSubjectFilter: { subjectType: 'user' } }",
				'});'
			),
			errors: unnamespaced('resourceType', 'subjectType')
		},
		{
			name: 'a raw watch object type',
			code: source("v1.WatchRequest.create({ optionalObjectTypes: [namespace.type('document'), 'folder'] });"),
			errors: unnamespaced('optionalObjectTypes')
		},
		{
			name: 'a conditional with a raw branch',
			code: source(
				"v1.ObjectReference.create({ objectType: isUser ? namespace.type('user') : 'tenant', objectId: '1' });"
			),
			errors: unnamespaced('objectType')
		},
		{
			name: 'a nullish fallback to a raw object type',
			code: source(
				"v1.ObjectReference.create({ objectType: optionalNamespace?.type('document') ?? 'document', objectId: '1' });"
			),
			errors: unnamespaced('objectType')
		}
	]
});

describe('require-namespaced-object-type without type information', () => {
	const code = source("v1.ObjectReference.create({ objectType: 'document', objectId: '1' });");

	it('should throw a MissingTypeInformationError instead of matching nothing', () => {
		expect(() => lintWithoutTypeInformation(code)).toThrow(MissingTypeInformationError);
	});

	it('should tell the caller which parser options to set', () => {
		expect(() => lintWithoutTypeInformation(code)).toThrow('Set languageOptions.parserOptions.project');
	});
});
