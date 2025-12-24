import { v1 } from '@authzed/authzed-node';

export interface LookupResourcesParams {
	subjectType: string;
	subjectId: string;
	resourceType: string;
	permission: string;
	limit: number;
	cursor?: string;
}

export function buildLookupResourcesRequest(params: LookupResourcesParams): v1.LookupResourcesRequest {
	const { subjectType, subjectId, resourceType, permission, limit, cursor } = params;

	return v1.LookupResourcesRequest.create({
		resourceObjectType: resourceType,
		permission: permission,
		subject: {
			object: {
				objectType: subjectType,
				objectId: subjectId
			},
			optionalRelation: ''
		},
		optionalLimit: limit,
		optionalCursor: cursor ? v1.Cursor.create({ token: cursor }) : undefined
	});
}

export interface LookupSubjectsParams {
	resourceType: string;
	resourceId: string;
	subjectType: string;
	permission: string;
}

export function buildLookupSubjectsRequest(params: LookupSubjectsParams): v1.LookupSubjectsRequest {
	const { resourceType, resourceId, subjectType, permission } = params;

	return v1.LookupSubjectsRequest.create({
		resource: {
			objectType: resourceType,
			objectId: resourceId
		},
		permission: permission,
		subjectObjectType: subjectType
	});
}
