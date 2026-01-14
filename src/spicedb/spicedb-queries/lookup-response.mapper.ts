import { v1 } from '@authzed/authzed-node';
import { TargetEntityItem, LookupTargetEntitiesResponse, EntityItem, LookupEntitiesResponse } from '../../types';
import { permissionshipMap } from '../lookup.constants';
import { decodeObjectId } from './base64.utils';

export function mapLookupTargetEntitiesResponse(
	results: v1.LookupResourcesResponse[],
	TargetEntityType: string,
	limit: number
): LookupTargetEntitiesResponse {
	const targets: TargetEntityItem[] = results.map((result) => ({
		TargetEntityType,
		TargetEntityId: decodeObjectId(result.resourceObjectId),
		permissionship: permissionshipMap.get(result.permissionship)
	}));

	const lastResult = results.length > 0 ? results[results.length - 1] : undefined;
	const nextCursor = lastResult?.afterResultCursor?.token;
	const shouldReturnCursor = results.length === limit;
	return {
		targets,
		cursor: shouldReturnCursor ? nextCursor : undefined,
		totalReturned: targets.length
	};
}

export function mapLookupEntitiesResponse(
	results: v1.LookupSubjectsResponse[],
	entityType: string
): LookupEntitiesResponse {
	const entities: EntityItem[] = results.map((result) => ({
		entityType,
		entityId: decodeObjectId(result.subject?.subjectObjectId ?? ''),
		permissionship: result.subject ? permissionshipMap.get(result.subject.permissionship) : undefined
	}));

	return {
		entities,
		totalReturned: entities.length
	};
}
