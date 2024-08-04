import { AxiosInstance } from 'axios';
import { LoggingClient } from './logging';
import {
	FeatureEntitlementsContext,
	PermissionsEntitlementsContext,
	RequestContextType,
	RouteEntitlementsContext
} from './types';

export interface ClientConfiguration {
	pdpHost: string;
	axiosInstance?: AxiosInstance;
	logging?: {
		client?: LoggingClient;
		logResults?: boolean;
	};
	timeout?: Milliseconds;
	fallbackConfiguration?: FallbackConfiguration;
}

export type Milliseconds = number;

export type FallbackConfiguration = {
	defaultFallback: boolean;
	[RequestContextType.Feature]?: Array<Pick<FeatureEntitlementsContext, 'featureKey'> & { fallback: boolean }>;
	[RequestContextType.Permission]?: Array<
		Pick<PermissionsEntitlementsContext, 'permissionKey'> & { fallback: boolean }
	>;
	[RequestContextType.Route]?: Array<Pick<RouteEntitlementsContext, 'method' | 'path'> & { fallback: boolean }>;
};
