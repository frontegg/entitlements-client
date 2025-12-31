export type Permissionship = 'HAS_PERMISSION' | 'CONDITIONAL_PERMISSION' | 'NO_PERMISSION';

export interface LookupBaseRequest {
	action: string;
	TargetEntityType: string;
	entityType: string;
}

export interface LookupBaseResponse {
	totalReturned: number;
}

export interface LookupBaseItem {
	permissionship?: Permissionship;
}

export interface LookupTargetEntitiesRequest extends LookupBaseRequest {
	entityId: string;
	limit?: number;
	cursor?: string;
}

export interface TargetEntityItem extends LookupBaseItem {
	TargetEntityType: string;
	TargetEntityId: string;
}

export interface LookupTargetEntitiesResponse extends LookupBaseResponse {
	targets: TargetEntityItem[];
	cursor?: string;
}

export interface EntityItem extends LookupBaseItem {
	entityType: string;
	entityId: string;
}

export interface LookupEntitiesRequest extends LookupBaseRequest {
	TargetEntityId: string;
}

export interface LookupEntitiesResponse extends LookupBaseResponse {
	entities: EntityItem[];
}
