export type Permissionship = 'HAS_PERMISSION' | 'CONDITIONAL_PERMISSION' | 'NO_PERMISSION';

export interface LookupRequest {
	permission: string;
}

export interface LookupResponse {
	cursor?: string;
	totalReturned: number;
}

export interface LookupResourcesRequest extends LookupRequest {
	subjectType: string;
	subjectId: string;
	resourceType: string;
	limit?: number;
	cursor?: string;
}

export interface LookupResourceItem {
	resourceType: string;
	resourceId: string;
	permissionship?: Permissionship;
}

export interface LookupResourcesResponse extends LookupResponse {
	resources: LookupResourceItem[];
}

export interface LookupSubjectsRequest extends LookupRequest {
	resourceType: string;
	resourceId: string;
	subjectType: string;
}

export interface LookupSubjectItem {
	subjectType: string;
	subjectId: string;
	permissionship?: Permissionship;
}

export interface LookupSubjectsResponse extends LookupResponse {
	subjects: LookupSubjectItem[];
}

export interface LookupResourcesParams {
	subjectType: string;
	subjectId: string;
	resourceType: string;
	permission: string;
	limit: number;
	cursor?: string;
}

export interface LookupSubjectsParams {
	resourceType: string;
	resourceId: string;
	subjectType: string;
	permission: string;
}
