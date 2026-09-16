import { FallbackConfiguration } from '../client-configuration';

export interface InstanceConfiguration {
	instanceId: string;
	vendorId: string;
	schemaPrefix?: string;
	fallbackConfiguration?: FallbackConfiguration;
}

export interface InstancesConfiguration {
	instances?: InstanceConfiguration[];
	defaultInstanceId?: string;
}
