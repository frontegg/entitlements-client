import { v1 } from '@authzed/authzed-node';
import { LookupResourcesRequest, LookupSubjectsRequest } from '../../types/lookup.types';
import { encodeObjectId } from './base64.utils';

export function buildLookupResourcesRequest(params: LookupResourcesRequest): v1.LookupResourcesRequest {
	const { subjectType, subjectId, resourceType, permission, limit, cursor } = params;

	return v1.LookupResourcesRequest.create({
		resourceObjectType: resourceType,
		permission: permission,
		subject: {
			object: {
				objectType: subjectType,
				objectId: encodeObjectId(subjectId)
			},
			optionalRelation: ''
		},
		optionalLimit: limit,
		optionalCursor: cursor ? v1.Cursor.create({ token: cursor }) : undefined
	});
}

export function buildLookupSubjectsRequest(params: LookupSubjectsRequest): v1.LookupSubjectsRequest {
	const { resourceType, resourceId, subjectType, permission } = params;

	return v1.LookupSubjectsRequest.create({
		resource: {
			objectType: resourceType,
			objectId: encodeObjectId(resourceId)
		},
		permission: permission,
		subjectObjectType: subjectType
	});
}
