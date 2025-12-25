export type Permissionship = 'HAS_PERMISSION' | 'CONDITIONAL_PERMISSION' | 'NO_PERMISSION';

export interface LookupBaseRequest {
	permission: string;
	resourceType: string;
	subjectType: string;
}

export interface LookupBaseResponse {
	totalReturned: number;
}

export interface LookupBaseItem {
	permissionship?: Permissionship;
}
export interface LookupResourcesRequest extends LookupBaseRequest {
	subjectId: string;
	limit?: number;
	cursor?: string;
}

export interface LookupResourceItem extends LookupBaseItem {
	resourceType: string;
	resourceId: string;
}

export interface LookupResourcesResponse extends LookupBaseResponse {
	resources: LookupResourceItem[];
	cursor?: string;
}

export interface LookupSubjectItem extends LookupBaseItem {
	subjectType: string;
	subjectId: string;
}
export interface LookupSubjectsRequest extends LookupBaseRequest {
	resourceId: string;
}

export interface LookupSubjectsResponse extends LookupBaseResponse {
	subjects: LookupSubjectItem[];
}
