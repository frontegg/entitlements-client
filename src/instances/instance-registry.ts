import { ConfigurationInputIsInvalidException } from '../exceptions/configuration-input-is-invalid.exception';
import { ConfigurationInputIsMissingException } from '../exceptions/configuration-input-is-missing.exception';
import { LEGACY_INSTANCE_ID, VENDOR_ID_SCHEMA_PREFIX_RULE } from './instance.constants';
import { InstanceConfiguration, InstancesConfiguration, ResolvedInstance } from './instance.types';
import { SchemaNamespace } from './schema-namespace';
import { deriveSchemaPrefix } from './schema-prefix.utils';

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
			: { instanceId: LEGACY_INSTANCE_ID, namespace: SchemaNamespace.legacy(LEGACY_INSTANCE_ID) };
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
		for (const [index, instance] of instances.entries()) {
			const schemaPrefix = this.assertInstance(instance, index, vendorIdOwners);
			vendorIdOwners.set(instance.vendorId, instance.instanceId);
			this.instances.set(instance.instanceId, {
				instanceId: instance.instanceId,
				namespace: SchemaNamespace.prefixed(schemaPrefix, instance.instanceId),
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
		vendorIdOwners: ReadonlyMap<string, string>
	): string {
		if (!instance.instanceId) {
			throw new ConfigurationInputIsMissingException(
				instance.vendorId
					? `instanceId is required for instances[${index}] (vendorId '${instance.vendorId}')`
					: `instanceId is required for instances[${index}]`
			);
		}

		if (instance.instanceId === LEGACY_INSTANCE_ID) {
			throw new ConfigurationInputIsInvalidException(
				`instanceId '${LEGACY_INSTANCE_ID}' on instances[${index}] is reserved for the unprefixed client`
			);
		}

		if (!instance.vendorId) {
			throw new ConfigurationInputIsMissingException(
				`vendorId is required for instance '${instance.instanceId}'`
			);
		}

		const schemaPrefix = deriveSchemaPrefix(instance.vendorId);
		if (schemaPrefix === undefined) {
			throw new ConfigurationInputIsInvalidException(
				`vendorId '${instance.vendorId}' for instance '${instance.instanceId}' cannot become a SpiceDB schema prefix; ` +
					`expected ${VENDOR_ID_SCHEMA_PREFIX_RULE}`
			);
		}

		if (this.instances.has(instance.instanceId)) {
			throw new ConfigurationInputIsInvalidException(`Duplicate instanceId '${instance.instanceId}'`);
		}

		const vendorIdOwner = vendorIdOwners.get(instance.vendorId);
		if (vendorIdOwner !== undefined) {
			throw new ConfigurationInputIsInvalidException(
				`Duplicate vendorId '${instance.vendorId}' on instances '${vendorIdOwner}' and '${instance.instanceId}'`
			);
		}

		return schemaPrefix;
	}
}
