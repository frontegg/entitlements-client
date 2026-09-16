import { ConfigurationInputIsInvalidException } from '../exceptions/configuration-input-is-invalid.exception';
import { ConfigurationInputIsMissingException } from '../exceptions/configuration-input-is-missing.exception';
import { LEGACY_INSTANCE_ID, SCHEMA_PREFIX_RULE } from './instance.constants';
import { InstanceConfiguration, InstancesConfiguration, ResolvedInstance } from './instance.types';
import { SchemaNamespace } from './schema-namespace';
import { deriveSchemaPrefix, isValidSchemaPrefix } from './schema-prefix.utils';

export class InstanceRegistry {
	private readonly instances = new Map<string, ResolvedInstance>();

	public readonly implicitInstance?: ResolvedInstance;

	constructor(configuration: InstancesConfiguration) {
		const defaultInstanceId = configuration.defaultInstanceId ?? undefined;

		if (configuration.instances) {
			this.register(configuration.instances);
		}

		if (defaultInstanceId !== undefined && !this.instances.has(defaultInstanceId)) {
			throw new ConfigurationInputIsInvalidException(
				this.instances.size === 0
					? `defaultInstanceId '${defaultInstanceId}' is set but no instances are configured`
					: `defaultInstanceId '${defaultInstanceId}' is not one of the configured instances: ${this.instanceIds.join(', ')}`
			);
		}

		this.implicitInstance = configuration.instances
			? this.resolveImplicitInstance(defaultInstanceId)
			: { instanceId: LEGACY_INSTANCE_ID, namespace: new SchemaNamespace('', LEGACY_INSTANCE_ID) };
	}

	public get instanceIds(): string[] {
		return [...this.instances.keys()];
	}

	public get(instanceId: string): ResolvedInstance | undefined {
		return this.instances.get(instanceId);
	}

	private register(instances: InstanceConfiguration[]): void {
		if (instances.length === 0) {
			throw new ConfigurationInputIsInvalidException(
				'instances must not be empty; omit it for an unprefixed client'
			);
		}

		const vendorIdOwners = new Map<string, string>();
		const schemaPrefixOwners = new Map<string, string>();
		for (const [index, instance] of instances.entries()) {
			const prefix = this.assertInstance(instance, index, vendorIdOwners, schemaPrefixOwners);
			this.instances.set(instance.instanceId, {
				instanceId: instance.instanceId,
				vendorId: instance.vendorId,
				namespace: new SchemaNamespace(prefix, instance.instanceId),
				fallbackConfiguration: instance.fallbackConfiguration
			});
		}
	}

	private resolveImplicitInstance(defaultInstanceId?: string): ResolvedInstance | undefined {
		if (defaultInstanceId !== undefined) {
			return this.instances.get(defaultInstanceId);
		}

		if (this.instances.size === 1) {
			const [only] = this.instances.values();
			return only;
		}

		return undefined;
	}

	private assertInstance(
		instance: InstanceConfiguration,
		index: number,
		vendorIdOwners: Map<string, string>,
		schemaPrefixOwners: Map<string, string>
	): string {
		if (!instance.instanceId) {
			throw new ConfigurationInputIsMissingException(
				instance.vendorId
					? `instanceId is required for instances[${index}] (vendorId '${instance.vendorId}')`
					: `instanceId is required for instances[${index}]`
			);
		}

		if (this.instances.has(instance.instanceId)) {
			throw new ConfigurationInputIsInvalidException(`Duplicate instanceId '${instance.instanceId}'`);
		}

		if (!instance.vendorId) {
			throw new ConfigurationInputIsMissingException(
				`vendorId is required for instance '${instance.instanceId}'`
			);
		}

		const vendorIdOwner = vendorIdOwners.get(instance.vendorId);
		if (vendorIdOwner !== undefined) {
			throw new ConfigurationInputIsInvalidException(
				`Duplicate vendorId '${instance.vendorId}' on instances '${vendorIdOwner}' and '${instance.instanceId}'`
			);
		}
		vendorIdOwners.set(instance.vendorId, instance.instanceId);

		const prefix = instance.schemaPrefix ?? deriveSchemaPrefix(instance.vendorId);

		if (prefix === '') {
			throw new ConfigurationInputIsInvalidException(
				`schemaPrefix must not be empty for instance '${instance.instanceId}'`
			);
		}

		const schemaPrefixOwner = schemaPrefixOwners.get(prefix);
		if (schemaPrefixOwner !== undefined) {
			throw new ConfigurationInputIsInvalidException(
				`Duplicate schemaPrefix '${prefix}' on instances '${schemaPrefixOwner}' and '${instance.instanceId}'; ` +
					'instances would share a namespace'
			);
		}
		schemaPrefixOwners.set(prefix, instance.instanceId);

		if (!isValidSchemaPrefix(prefix)) {
			throw new ConfigurationInputIsInvalidException(
				instance.schemaPrefix === undefined
					? `Schema prefix '${prefix}' derived from vendorId '${instance.vendorId}' for instance '${instance.instanceId}' ` +
						`is not a valid SpiceDB namespace (${SCHEMA_PREFIX_RULE}); set schemaPrefix explicitly`
					: `Invalid schemaPrefix '${prefix}' for instance '${instance.instanceId}'. Expected ${SCHEMA_PREFIX_RULE}`
			);
		}

		return prefix;
	}
}
