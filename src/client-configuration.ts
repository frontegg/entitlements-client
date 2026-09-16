import { LoggingClient } from './logging';
import { FallbackConfiguration } from './types';

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
