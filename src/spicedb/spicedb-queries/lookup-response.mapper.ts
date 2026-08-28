import { v1 } from '@authzed/authzed-node';
import {
	TargetEntityItem,
	LookupTargetEntitiesResponse,
	EntityItem,
	LookupEntitiesResponse,
	LookupEntitlementsResponse,
	EntitlementItem,
	RequestContextType
} from '../../types';
import { permissionshipMap } from '../lookup.constants';
import { decodeObjectId } from './base64.utils';
import { SchemaScope } from '../../instances/schema-scope';

export function mapLookupTargetEntitiesResponse(
	results: v1.LookupResourcesResponse[],
	TargetEntityType: string,
	limit: number,
	scope: SchemaScope
): LookupTargetEntitiesResponse {
	const targets: TargetEntityItem[] = results.map((result) => ({
		TargetEntityType: scope.strip(TargetEntityType),
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
	entityType: string,
	scope: SchemaScope
): LookupEntitiesResponse {
	const entities: EntityItem[] = results.map((result) => ({
		entityType: scope.strip(entityType),
		entityId: decodeObjectId(result.subject?.subjectObjectId ?? ''),
		permissionship: result.subject ? permissionshipMap.get(result.subject.permissionship) : undefined
	}));

	return {
		entities,
		totalReturned: entities.length
	};
}

export function mapLookupEntitlementsResponse(
	results: v1.LookupResourcesResponse[],
	type: RequestContextType
): Omit<LookupEntitlementsResponse, 'cursor'> {
	const entitlements: EntitlementItem[] = [];
	const seenKeys = new Set<string>();

	for (const result of results) {
		const key = decodeObjectId(result.resourceObjectId);
		if (seenKeys.has(key)) {
			continue;
		}

		seenKeys.add(key);
		entitlements.push({
			type,
			key,
			permissionship: permissionshipMap.get(result.permissionship)
		});
	}

	return {
		entitlements,
		totalReturned: entitlements.length
	};
}
