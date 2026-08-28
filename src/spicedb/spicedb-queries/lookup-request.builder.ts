import { v1 } from '@authzed/authzed-node';
import {
	LookupTargetEntitiesRequest,
	LookupEntitiesRequest,
	LookupEntitlementsRequest,
	LookupEntitlementsSubject,
	RequestContextType
} from '../../types';
import { encodeObjectId } from './base64.utils';
import { createActiveAtCaveatContext, createTargetingCaveatContext } from './caveat-context.utils';
import { SpiceDBEntities } from '../../types/spicedb-consts';
import { SchemaScope } from '../../instances/schema-scope';

export function buildLookupTargetEntitiesRequest(
	params: LookupTargetEntitiesRequest,
	scope: SchemaScope
): v1.LookupResourcesRequest {
	const { entityType, entityId, TargetEntityType, action, limit, cursor, at } = params;
	const caveatContext = createActiveAtCaveatContext(at);

	return v1.LookupResourcesRequest.create({
		resourceObjectType: scope.type(TargetEntityType),
		permission: action,
		subject: {
			object: {
				objectType: scope.type(entityType),
				objectId: encodeObjectId(entityId)
			},
			optionalRelation: ''
		},
		optionalLimit: limit,
		optionalCursor: cursor ? v1.Cursor.create({ token: cursor }) : undefined,
		context: caveatContext
	});
}

export function buildLookupEntitiesRequest(
	params: LookupEntitiesRequest,
	scope: SchemaScope
): v1.LookupSubjectsRequest {
	const { TargetEntityType, TargetEntityId, entityType, action, at } = params;
	const caveatContext = createActiveAtCaveatContext(at);

	return v1.LookupSubjectsRequest.create({
		resource: {
			objectType: scope.type(TargetEntityType),
			objectId: encodeObjectId(TargetEntityId)
		},
		permission: action,
		subjectObjectType: scope.type(entityType),
		context: caveatContext
	});
}

export function buildLookupEntitlementsRequest(
	params: LookupEntitlementsRequest,
	subject: LookupEntitlementsSubject,
	scope: SchemaScope,
	now?: string
): v1.LookupResourcesRequest {
	const { criteria, limit } = params;
	const caveatContext = createTargetingCaveatContext(params.subject.attributes, now);

	// Forward-compatibility guard: LookupEntitlementsCriteria is currently a union of one type,
	// so TypeScript already prevents reaching this at compile time. When new criteria types are
	// added to the union, this throw becomes the runtime boundary until a handler is implemented.
	if (criteria.type !== RequestContextType.Feature) {
		throw new Error(`Unsupported lookup entitlements criteria type: ${criteria.type}`);
	}

	return v1.LookupResourcesRequest.create({
		resourceObjectType: scope.type(SpiceDBEntities.Feature),
		permission: 'access',
		subject: {
			object: {
				objectType: scope.type(subject.entityType),
				objectId: encodeObjectId(subject.entityId)
			},
			optionalRelation: ''
		},
		optionalLimit: limit,
		optionalCursor: subject.cursor ? v1.Cursor.create({ token: subject.cursor }) : undefined,
		context: caveatContext
	});
}
