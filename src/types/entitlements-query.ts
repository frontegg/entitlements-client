import {
	FeatureEntitlementsContext,
	PermissionsEntitlementsContext,
	RouteEntitlementsContext,
	EntityEntitlementsContext
} from './request-context';
import { SubjectContext } from './subject-context';

export type EntitlementsQueryRequestContext =
	| Omit<FeatureEntitlementsContext, 'type'>
	| Omit<PermissionsEntitlementsContext, 'type'>
	| Omit<RouteEntitlementsContext, 'type'>
	| Omit<EntityEntitlementsContext, 'type'>;

export interface EntitlementsQuery {
	subjectContext: SubjectContext;
	requestContext: EntitlementsQueryRequestContext;
}
