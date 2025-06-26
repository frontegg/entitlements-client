import { RequestContextType } from './request-context-type.enum';

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

export interface EntityEntitlementsContext {
	type: RequestContextType.Entity;
	entityType: string;
	key: string;
	action: string;
}

export interface CompositeEntitlementsContext {
	type: RequestContextType.Composite;
	[RequestContextType.Feature]: Partial<FeatureEntitlementsContext>;
	[RequestContextType.Permission]: Partial<PermissionsEntitlementsContext>;
	[RequestContextType.Route]: Partial<RouteEntitlementsContext>;
	[RequestContextType.Entity]: Partial<EntityEntitlementsContext>;
}

export type RequestContext =
	| FeatureEntitlementsContext
	| PermissionsEntitlementsContext
	| RouteEntitlementsContext
	| EntityEntitlementsContext
	| CompositeEntitlementsContext;
