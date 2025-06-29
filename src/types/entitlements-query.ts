import {
	FeatureEntitlementsContext,
	PermissionsEntitlementsContext,
	RouteEntitlementsContext,
	EntityEntitlementsContext,
	CompositeEntitlementsContext
} from './request-context';
import { SubjectContext } from './subject-context';

export type EntitlementsQueryRequestContext =
	| Omit<FeatureEntitlementsContext, 'type'>
	| Omit<PermissionsEntitlementsContext, 'type'>
	| Omit<RouteEntitlementsContext, 'type'>
	| Omit<EntityEntitlementsContext, 'type'>
	| Omit<CompositeEntitlementsContext, 'type'>;

export interface EntitlementsQuery {
	subjectContext: SubjectContext;
	requestContext: EntitlementsQueryRequestContext;
}
