import { FallbackConfiguration } from '../client-configuration';
import { ConfigurationInputIsInvalidException } from '../exceptions/configuration-input-is-invalid.exception';
import { ConfigurationInputIsMissingException } from '../exceptions/configuration-input-is-missing.exception';
import { InstanceConfiguration, InstancesConfiguration } from './instance-configuration';
import { SchemaNamespace } from './schema-namespace';
import { deriveSchemaPrefix, isValidSchemaPrefix, SCHEMA_PREFIX_RULE } from './schema-prefix';

export const LEGACY_INSTANCE_ID = 'legacy';

export interface ResolvedInstance {
	instanceId: string;
	vendorId?: string;
	namespace: SchemaNamespace;
	fallbackConfiguration?: FallbackConfiguration;
}

export class InstanceRegistry {
	private readonly instances = new Map<string, ResolvedInstance>();

	public readonly defaultInstanceId?: string;
	public readonly implicitInstance?: ResolvedInstance;

	constructor(configuration: InstancesConfiguration) {
		const declared = configuration.instances ?? [];

		if (declared.length === 0) {
			this.instances.set(LEGACY_INSTANCE_ID, {
				instanceId: LEGACY_INSTANCE_ID,
				namespace: new SchemaNamespace('', LEGACY_INSTANCE_ID)
			});
		}

		const seenVendorIds = new Set<string>();
		const seenPrefixes = new Set<string>();
		for (const instance of declared) {
			const prefix = this.assertInstance(instance, seenVendorIds, seenPrefixes);
			this.instances.set(instance.instanceId, {
				instanceId: instance.instanceId,
				vendorId: instance.vendorId,
				namespace: new SchemaNamespace(prefix, instance.instanceId),
				fallbackConfiguration: instance.fallbackConfiguration
			});
		}

		this.defaultInstanceId = configuration.defaultInstanceId;
		if (this.defaultInstanceId !== undefined && !this.instances.has(this.defaultInstanceId)) {
			throw new ConfigurationInputIsInvalidException(
				`defaultInstanceId '${this.defaultInstanceId}' is not one of the configured instances: ${this.instanceIds.join(', ')}`
			);
		}

		this.implicitInstance = this.resolveImplicitInstance();
	}

	public get instanceIds(): string[] {
		return [...this.instances.keys()];
	}

	public get size(): number {
		return this.instances.size;
	}

	public get(instanceId: string): ResolvedInstance | undefined {
		return this.instances.get(instanceId);
	}

	private resolveImplicitInstance(): ResolvedInstance | undefined {
		if (this.defaultInstanceId !== undefined) {
			return this.instances.get(this.defaultInstanceId);
		}

		if (this.instances.size === 1) {
			return this.instances.values().next().value as ResolvedInstance;
		}

		return undefined;
	}

	private assertInstance(
		instance: InstanceConfiguration,
		seenVendorIds: Set<string>,
		seenPrefixes: Set<string>
	): string {
		if (!instance.instanceId) {
			throw new ConfigurationInputIsMissingException('instanceId is required for every configured instance');
		}

		if (this.instances.has(instance.instanceId)) {
			throw new ConfigurationInputIsInvalidException(`Duplicate instanceId '${instance.instanceId}'`);
		}

		if (!instance.vendorId) {
			throw new ConfigurationInputIsMissingException(
				`vendorId is required for instance '${instance.instanceId}'`
			);
		}

		if (seenVendorIds.has(instance.vendorId)) {
			throw new ConfigurationInputIsInvalidException(
				`Duplicate vendorId '${instance.vendorId}' on instance '${instance.instanceId}'`
			);
		}
		seenVendorIds.add(instance.vendorId);

		const prefix = instance.schemaPrefix ?? deriveSchemaPrefix(instance.vendorId);

		if (prefix === '') {
			throw new ConfigurationInputIsInvalidException(
				`schemaPrefix must not be empty for instance '${instance.instanceId}'`
			);
		}

		if (seenPrefixes.has(prefix)) {
			throw new ConfigurationInputIsInvalidException(
				`Duplicate schemaPrefix '${prefix}' on instance '${instance.instanceId}'; instances would share a namespace`
			);
		}
		seenPrefixes.add(prefix);

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
