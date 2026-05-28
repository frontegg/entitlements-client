import { v1 } from '@authzed/authzed-node';
import {
	LookupTargetEntitiesRequest,
	LookupEntitiesRequest,
	LookupEntitlementsRequest,
	RequestContextType
} from '../../types';
import { encodeObjectId } from './base64.utils';
import { createActiveAtCaveatContext, createTargetingCaveatContext } from './caveat-context.utils';
import { SpiceDBEntities } from '../../types/spicedb-consts';

export interface LookupEntitlementsSubject {
	entityType: string;
	entityId: string;
	cursor?: string;
}

export function buildLookupTargetEntitiesRequest(params: LookupTargetEntitiesRequest): v1.LookupResourcesRequest {
	const { entityType, entityId, TargetEntityType, action, limit, cursor, at } = params;
	const caveatContext = createActiveAtCaveatContext(at);

	return v1.LookupResourcesRequest.create({
		resourceObjectType: TargetEntityType,
		permission: action,
		subject: {
			object: {
				objectType: entityType,
				objectId: encodeObjectId(entityId)
			},
			optionalRelation: ''
		},
		optionalLimit: limit,
		optionalCursor: cursor ? v1.Cursor.create({ token: cursor }) : undefined,
		context: caveatContext
	});
}

export function buildLookupEntitiesRequest(params: LookupEntitiesRequest): v1.LookupSubjectsRequest {
	const { TargetEntityType, TargetEntityId, entityType, action, at } = params;
	const caveatContext = createActiveAtCaveatContext(at);

	return v1.LookupSubjectsRequest.create({
		resource: {
			objectType: TargetEntityType,
			objectId: encodeObjectId(TargetEntityId)
		},
		permission: action,
		subjectObjectType: entityType,
		context: caveatContext
	});
}

export function buildLookupEntitlementsRequest(
	params: LookupEntitlementsRequest,
	subject: LookupEntitlementsSubject
): v1.LookupResourcesRequest {
	const { criteria, limit } = params;
	const caveatContext = createTargetingCaveatContext(params.subject.attributes);

	// Forward-compatibility guard: LookupEntitlementsCriteria is currently a union of one type,
	// so TypeScript already prevents reaching this at compile time. When new criteria types are
	// added to the union, this throw becomes the runtime boundary until a handler is implemented.
	if (criteria.type !== RequestContextType.Feature) {
		throw new Error(`Unsupported lookup entitlements criteria type: ${criteria.type}`);
	}

	return v1.LookupResourcesRequest.create({
		resourceObjectType: SpiceDBEntities.Feature,
		permission: 'access',
		subject: {
			object: {
				objectType: subject.entityType,
				objectId: encodeObjectId(subject.entityId)
			},
			optionalRelation: ''
		},
		optionalLimit: limit,
		optionalCursor: subject.cursor ? v1.Cursor.create({ token: subject.cursor }) : undefined,
		context: caveatContext
	});
}
