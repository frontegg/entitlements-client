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
	[RequestContextType.Feature]?: Record<string, boolean>;
	[RequestContextType.Permission]?: Record<string, boolean>;
	[RequestContextType.Route]?: Record<string, boolean>;
};
