export type SubjectContext = UserSubjectContext | FGASubjectContext | CompositeSubjectContext;

type Nullable<T> = { [K in keyof T]: T[K] | null };

export type CompositeSubjectContext = Nullable<UserSubjectContext> & Nullable<FGASubjectContext>;

export type UserSubjectContext = {
	userId?: string | null;
	tenantId: string;
	permissions?: string[];
	attributes?: Record<string, unknown>;
};

export type FGASubjectContext = {
	entityType: string;
	key: string;
};

export function isFGASubjectContext(subject: SubjectContext): subject is FGASubjectContext {
	return !!(subject as FGASubjectContext).entityType;
}

export function isCompositeSubjectContext(subject: SubjectContext): subject is CompositeSubjectContext {
	return !!(subject as CompositeSubjectContext).tenantId && !!(subject as CompositeSubjectContext).entityType;
}
