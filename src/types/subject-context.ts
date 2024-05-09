export interface SubjectContext {
    userId: string;
    tenantId: string;
    permissions: string[];
    attributes: Record<string, unknown>;
}