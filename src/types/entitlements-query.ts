import {FeatureEntitlementsContext, PermissionsEntitlementsContext, RouteEntitlementsContext} from './request-context';
import {SubjectContext} from './subject-context';

export type EntitlementsQueryRequestContext =
        Omit<FeatureEntitlementsContext, 'type'>
        | Omit<PermissionsEntitlementsContext, 'type'>
        | Omit<RouteEntitlementsContext, 'type'>;

export interface EntitlementsQuery {
    subjectContext: SubjectContext;
    requestContext: EntitlementsQueryRequestContext;
}

