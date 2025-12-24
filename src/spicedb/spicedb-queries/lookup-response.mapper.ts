import { v1 } from '@authzed/authzed-node';
import {
	LookupResourceItem,
	LookupResourcesResponse,
	LookupSubjectItem,
	LookupSubjectsResponse,
	Permissionship
} from '../../types';

export function mapPermissionship(permissionship: v1.LookupPermissionship): Permissionship | undefined {
	switch (permissionship) {
		case v1.LookupPermissionship.HAS_PERMISSION:
			return 'HAS_PERMISSION';
		case v1.LookupPermissionship.CONDITIONAL_PERMISSION:
			return 'CONDITIONAL_PERMISSION';
		case v1.LookupPermissionship.UNSPECIFIED:
			return undefined;
		default:
			return undefined;
	}
}

export function mapLookupResourcesResponse(
	results: v1.LookupResourcesResponse[],
	resourceType: string,
	limit: number
): LookupResourcesResponse {
	const resources: LookupResourceItem[] = results.map((result) => ({
		resourceType,
		resourceId: result.resourceObjectId,
		permissionship: mapPermissionship(result.permissionship)
	}));

	const lastResult = results.length > 0 ? results[results.length - 1] : undefined;
	const nextCursor = lastResult?.afterResultCursor?.token;
	const shouldReturnCursor = results.length === limit;
	return {
		resources,
		cursor: shouldReturnCursor ? nextCursor : undefined,
		totalReturned: resources.length
	};
}

export function mapLookupSubjectsResponse(
	results: v1.LookupSubjectsResponse[],
	subjectType: string
): LookupSubjectsResponse {
	const subjects: LookupSubjectItem[] = results.map((result) => ({
		subjectType,
		subjectId: result.subject?.subjectObjectId ?? '',
		permissionship: result.subject ? mapPermissionship(result.subject.permissionship) : undefined
	}));

	return {
		subjects,
		totalReturned: subjects.length
	};
}
