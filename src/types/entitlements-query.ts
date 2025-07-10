import {
	FeatureEntitlementsContext,
	PermissionsEntitlementsContext,
	RouteEntitlementsContext,
	EntityEntitlementsContext
} from './request-context';
import { SubjectContext } from './subject-context';
import { RequestContextType } from './request-context-type.enum';

export type EntitlementsQueryRequestContext =
	| Omit<FeatureEntitlementsContext, 'type'>
	| Omit<PermissionsEntitlementsContext, 'type'>
	| Omit<RouteEntitlementsContext, 'type'>
	| Omit<EntityEntitlementsContext, 'type'>;

export interface EntitlementsQuery {
	subjectContext: SubjectContext;
	requestContext: EntitlementsQueryRequestContext;
}

export type EntitlementsDynamicQueryRequestContext<T extends RequestContextType> =
	T extends RequestContextType.Permission
		? PermissionsEntitlementsContext
		: T extends RequestContextType.Feature
			? FeatureEntitlementsContext
			: T extends RequestContextType.Route
				? RouteEntitlementsContext
				: T extends RequestContextType.Entity
					? EntityEntitlementsContext
					: never;

export interface EntitlementsDynamicQuery<T extends RequestContextType> {
	subjectContext: SubjectContext;
	requestContext: EntitlementsDynamicQueryRequestContext<T>;
}
