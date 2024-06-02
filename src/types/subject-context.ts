export interface SubjectContext {
	userId?: string | null;
	tenantId: string;
	permissions?: string[];
	attributes?: Record<string, unknown>;
}
