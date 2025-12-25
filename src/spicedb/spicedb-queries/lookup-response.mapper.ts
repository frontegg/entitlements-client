import { v1 } from '@authzed/authzed-node';
import {
	LookupResourceItem,
	LookupResourcesResponse,
	LookupSubjectItem,
	LookupSubjectsResponse,
	Permissionship
} from '../../types';
import { permissionshipMap } from '../lookup.constants';
import { decodeObjectId } from './base64.utils';

export function mapLookupResourcesResponse(
	results: v1.LookupResourcesResponse[],
	resourceType: string,
	limit: number
): LookupResourcesResponse {
	const resources: LookupResourceItem[] = results.map((result) => ({
		resourceType,
		resourceId: decodeObjectId(result.resourceObjectId),
		permissionship: permissionshipMap.get(result.permissionship)
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
		subjectId: decodeObjectId(result.subject?.subjectObjectId ?? ''),
		permissionship: result.subject ? permissionshipMap.get(result.subject.permissionship) : undefined
	}));

	return {
		subjects,
		totalReturned: subjects.length
	};
}
