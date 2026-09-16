import { RequestContext } from './request-context';
import { RequestContextType } from './request-context-type.enum';

export type FallbackConfiguration = StaticFallbackConfiguration | FunctionFallbackConfiguration;

export type StaticFallbackConfiguration = {
	defaultFallback: boolean;
	[RequestContextType.Feature]?: Record<string, boolean>;
	[RequestContextType.Permission]?: Record<string, boolean>;
	[RequestContextType.Route]?: Record<string, boolean>;
	[RequestContextType.Entity]?: Record<string, boolean>;
};

export type FunctionFallbackConfiguration = (requestContext: RequestContext) => Promise<boolean> | boolean;
