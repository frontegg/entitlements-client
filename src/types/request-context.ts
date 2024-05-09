import {RequestContextType} from './request-context-type.enum';

export interface FeatureEntitlementsContext {
    type: RequestContextType.Feature;
    featureKey: string;
}

export interface PermissionsEntitlementsContext {
    type: RequestContextType.Permission;
    permissionKey: string;
}

export interface RouteEntitlementsContext {
    type: RequestContextType.Route;
    method: string;
    path: string;
}

export type RequestContext = FeatureEntitlementsContext | PermissionsEntitlementsContext | RouteEntitlementsContext;