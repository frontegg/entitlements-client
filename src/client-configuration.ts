import { AxiosInstance } from 'axios';
import { LoggingClient } from './logging';
import {
	FeatureEntitlementsContext,
	PermissionsEntitlementsContext,
	RequestContext,
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

export type FallbackConfiguration = StaticFallbackConfiguration | FunctionFallbackConfiguration;

export type StaticFallbackConfiguration = {
	defaultFallback: boolean;
	[RequestContextType.Feature]?: Record<string, boolean>;
	[RequestContextType.Permission]?: Record<string, boolean>;
	[RequestContextType.Route]?: Record<string, boolean>;
};

export type FunctionFallbackConfiguration = (requestContext: RequestContext) => Promise<boolean>;
