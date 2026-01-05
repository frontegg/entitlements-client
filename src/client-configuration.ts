import { LoggingClient } from './logging';
import { RequestContext, RequestContextType } from './types';

export interface ClientConfiguration {
	engineEndpoint: string;
	engineToken: string;
	logging?: {
		client?: LoggingClient;
		logResults?: boolean;
	};
	fallbackConfiguration?: FallbackConfiguration;
}

export type Milliseconds = number;

export type FallbackConfiguration = StaticFallbackConfiguration | FunctionFallbackConfiguration;

export type StaticFallbackConfiguration = {
	defaultFallback: boolean;
	[RequestContextType.Feature]?: Record<string, boolean>;
	[RequestContextType.Permission]?: Record<string, boolean>;
	[RequestContextType.Route]?: Record<string, boolean>;
	[RequestContextType.Entity]?: Record<string, boolean>;
};

export type FunctionFallbackConfiguration = (requestContext: RequestContext) => Promise<boolean> | boolean;
