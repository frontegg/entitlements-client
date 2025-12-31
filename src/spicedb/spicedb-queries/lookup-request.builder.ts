import { v1 } from '@authzed/authzed-node';
import { LookupTargetEntitiesRequest, LookupEntitiesRequest } from '../../types/lookup.types';
import { encodeObjectId } from './base64.utils';

export function buildLookupTargetEntitiesRequest(params: LookupTargetEntitiesRequest): v1.LookupResourcesRequest {
	const { entityType, entityId, TargetEntityType, action, limit, cursor } = params;

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
		optionalCursor: cursor ? v1.Cursor.create({ token: cursor }) : undefined
	});
}

export function buildLookupEntitiesRequest(params: LookupEntitiesRequest): v1.LookupSubjectsRequest {
	const { TargetEntityType, TargetEntityId, entityType, action } = params;

	return v1.LookupSubjectsRequest.create({
		resource: {
			objectType: TargetEntityType,
			objectId: encodeObjectId(TargetEntityId)
		},
		permission: action,
		subjectObjectType: entityType
	});
}
