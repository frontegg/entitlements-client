import { FallbackConfiguration } from '../types';
import { SchemaNamespace } from './schema-namespace';

export interface InstanceConfiguration {
	instanceId: string;
	vendorId: string;
	fallbackConfiguration?: FallbackConfiguration;
}

export interface InstancesConfiguration {
	instances?: InstanceConfiguration[] | null;
	defaultInstanceId?: string | null;
}

export interface ResolvedInstance {
	instanceId: string;
	namespace: SchemaNamespace;
	fallbackConfiguration?: FallbackConfiguration;
}
