import { RequestContextType } from './request-context-type.enum';

type Nullable<T> = { [K in keyof T]: T[K] | null };

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
	[RequestContextType.Permission]: Nullable<PermissionsEntitlementsContext>;
	[RequestContextType.Entity]: Nullable<EntityEntitlementsContext>;
}

export type RequestContext =
	| FeatureEntitlementsContext
	| PermissionsEntitlementsContext
	| RouteEntitlementsContext
	| EntityEntitlementsContext
	| CompositeEntitlementsContext;
