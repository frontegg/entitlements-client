import { LoggingClient } from './logging';
import { FallbackConfiguration } from './types';
import { InstancesConfiguration } from './instances/instance.types';

export interface ClientConfiguration extends InstancesConfiguration {
	engineEndpoint: string;
	engineToken: string;
	logging?: {
		client?: LoggingClient;
		logResults?: boolean;
	};
	fallbackConfiguration?: FallbackConfiguration;
}

export type Milliseconds = number;
