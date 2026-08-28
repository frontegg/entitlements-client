import { ClientConfiguration, FallbackConfiguration, InstanceConfiguration } from '../client-configuration';
import { ConfigurationInputIsInvalidException } from '../exceptions/configuration-input-is-invalid.exception';
import { SchemaScope } from './schema-scope';
import { deriveSchemaPrefix, isValidSchemaPrefix } from './schema-prefix';

export const LEGACY_INSTANCE_ID = 'default';

export interface ResolvedInstance {
	instanceId: string;
	vendorId?: string;
	scope: SchemaScope;
	fallbackConfiguration?: FallbackConfiguration;
}

export class InstanceRegistry {
	private readonly instances: Map<string, ResolvedInstance>;
	private readonly order: string[];

	constructor(
		configuration: Pick<ClientConfiguration, 'instances' | 'defaultInstanceId'>,
		public readonly defaultInstanceId?: string
	) {
		const declared = configuration.instances;
		this.instances = new Map();
		this.order = [];

		if (!declared || declared.length === 0) {
			const legacy: ResolvedInstance = {
				instanceId: LEGACY_INSTANCE_ID,
				scope: new SchemaScope('')
			};
			this.instances.set(legacy.instanceId, legacy);
			this.order.push(legacy.instanceId);
		} else {
			const seenVendorIds = new Set<string>();
			for (const instance of declared) {
				this.assertInstance(instance, seenVendorIds);
				const resolved: ResolvedInstance = {
					instanceId: instance.instanceId,
					vendorId: instance.vendorId,
					scope: new SchemaScope(this.resolvePrefix(instance)),
					fallbackConfiguration: instance.fallbackConfiguration
				};
				this.instances.set(resolved.instanceId, resolved);
				this.order.push(resolved.instanceId);
			}
		}

		if (defaultInstanceId !== undefined && !this.instances.has(defaultInstanceId)) {
			throw new ConfigurationInputIsInvalidException(
				`defaultInstanceId '${defaultInstanceId}' is not one of the configured instances: ${this.order.join(', ')}`
			);
		}
	}

	public get instanceIds(): string[] {
		return [...this.order];
	}

	public get size(): number {
		return this.order.length;
	}

	public get onlyInstance(): ResolvedInstance {
		return this.instances.get(this.order[0]) as ResolvedInstance;
	}

	public get(instanceId: string): ResolvedInstance | undefined {
		return this.instances.get(instanceId);
	}

	private resolvePrefix(instance: InstanceConfiguration): string {
		if (instance.schemaPrefix !== undefined) {
			return instance.schemaPrefix;
		}

		return deriveSchemaPrefix(instance.vendorId);
	}

	private assertInstance(instance: InstanceConfiguration, seenVendorIds: Set<string>): void {
		if (!instance.instanceId) {
			throw new ConfigurationInputIsInvalidException('instanceId is required for every configured instance');
		}

		if (this.instances.has(instance.instanceId)) {
			throw new ConfigurationInputIsInvalidException(`Duplicate instanceId '${instance.instanceId}'`);
		}

		if (!instance.vendorId) {
			throw new ConfigurationInputIsInvalidException(
				`vendorId is required for instance '${instance.instanceId}'`
			);
		}

		if (seenVendorIds.has(instance.vendorId)) {
			throw new ConfigurationInputIsInvalidException(
				`Duplicate vendorId '${instance.vendorId}' on instance '${instance.instanceId}'`
			);
		}
		seenVendorIds.add(instance.vendorId);

		const prefix = this.resolvePrefix(instance);
		if (!isValidSchemaPrefix(prefix)) {
			throw new ConfigurationInputIsInvalidException(
				`Invalid schemaPrefix '${prefix}' for instance '${instance.instanceId}'. ` +
					`Expected an empty string or a SpiceDB identifier matching /^[a-z_][a-z0-9_]{1,62}[a-z0-9]$/`
			);
		}
	}
}
