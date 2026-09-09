import { InstanceRegistry, LEGACY_INSTANCE_ID } from './instance-registry';
import { ConfigurationInputIsInvalidException } from '../exceptions/configuration-input-is-invalid.exception';

const VENDOR_A = '2f9c1a44-7b0e-4a1e-9f8a-1c2d3e4f5a6b';
const VENDOR_B = '8b1d0e77-3c5a-4f2b-9d6e-7a8b9c0d1e2f';

describe(InstanceRegistry.name, () => {
	it('should synthesise a legacy instance when no instances are configured', () => {
		const registry = new InstanceRegistry({});

		expect(registry.size).toBe(1);
		expect(registry.instanceIds).toEqual([LEGACY_INSTANCE_ID]);
		expect(registry.onlyInstance.namespace.isLegacy).toBe(true);
	});

	it('should synthesise a legacy instance for an empty instances array', () => {
		const registry = new InstanceRegistry({ instances: [] });

		expect(registry.onlyInstance.namespace.isLegacy).toBe(true);
	});

	it('should derive a schema prefix from each vendorId', () => {
		const registry = new InstanceRegistry({
			instances: [
				{ instanceId: 'a', vendorId: VENDOR_A },
				{ instanceId: 'b', vendorId: VENDOR_B }
			]
		});

		expect(registry.get('a')?.namespace.schemaPrefix).toBe('v_2f9c1a44_7b0e_4a1e_9f8a_1c2d3e4f5a6b');
		expect(registry.get('b')?.namespace.schemaPrefix).toBe('v_8b1d0e77_3c5a_4f2b_9d6e_7a8b9c0d1e2f');
	});

	it('should honour an explicit schemaPrefix override', () => {
		const registry = new InstanceRegistry({
			instances: [{ instanceId: 'a', vendorId: VENDOR_A, schemaPrefix: 'v_custom' }]
		});

		expect(registry.get('a')?.namespace.schemaPrefix).toBe('v_custom');
	});

	it('should reject an empty schemaPrefix inside a populated instances list', () => {
		expect(
			() =>
				new InstanceRegistry({
					instances: [{ instanceId: 'a', vendorId: VENDOR_A, schemaPrefix: '' }]
				})
		).toThrow(/must not be empty/);
	});

	it('should reject two instances resolving to the same schemaPrefix', () => {
		expect(
			() =>
				new InstanceRegistry({
					instances: [
						{ instanceId: 'a', vendorId: VENDOR_A, schemaPrefix: 'shared_ns' },
						{ instanceId: 'b', vendorId: VENDOR_B, schemaPrefix: 'shared_ns' }
					]
				})
		).toThrow(/Duplicate schemaPrefix/);
	});

	it('should reject two vendorIds that normalise to the same prefix', () => {
		expect(
			() =>
				new InstanceRegistry({
					instances: [
						{ instanceId: 'a', vendorId: 'ACME-CORP' },
						{ instanceId: 'b', vendorId: 'acme_corp' }
					]
				})
		).toThrow(/Duplicate schemaPrefix/);
	});

	it('should throw on a missing instanceId', () => {
		expect(() => new InstanceRegistry({ instances: [{ instanceId: '', vendorId: VENDOR_A }] })).toThrow(
			ConfigurationInputIsInvalidException
		);
	});

	it('should throw on a missing vendorId', () => {
		expect(() => new InstanceRegistry({ instances: [{ instanceId: 'a', vendorId: '' }] })).toThrow(
			ConfigurationInputIsInvalidException
		);
	});

	it('should throw on a duplicate instanceId', () => {
		expect(
			() =>
				new InstanceRegistry({
					instances: [
						{ instanceId: 'a', vendorId: VENDOR_A },
						{ instanceId: 'a', vendorId: VENDOR_B }
					]
				})
		).toThrow(ConfigurationInputIsInvalidException);
	});

	it('should throw on a duplicate vendorId', () => {
		expect(
			() =>
				new InstanceRegistry({
					instances: [
						{ instanceId: 'a', vendorId: VENDOR_A },
						{ instanceId: 'b', vendorId: VENDOR_A }
					]
				})
		).toThrow(ConfigurationInputIsInvalidException);
	});

	it('should throw on an invalid schemaPrefix', () => {
		expect(
			() =>
				new InstanceRegistry({
					instances: [{ instanceId: 'a', vendorId: VENDOR_A, schemaPrefix: 'Not/Valid' }]
				})
		).toThrow(ConfigurationInputIsInvalidException);
	});

	it('should throw when two explicit schemaPrefix overrides collide', () => {
		expect(
			() =>
				new InstanceRegistry({
					instances: [
						{ instanceId: 'a', vendorId: VENDOR_A, schemaPrefix: 'v_shared' },
						{ instanceId: 'b', vendorId: VENDOR_B, schemaPrefix: 'v_shared' }
					]
				})
		).toThrow(ConfigurationInputIsInvalidException);
	});

	it('should throw when two distinct vendorIds normalise to the same prefix', () => {
		expect(
			() =>
				new InstanceRegistry({
					instances: [
						{ instanceId: 'a', vendorId: 'ACME-CORP' },
						{ instanceId: 'b', vendorId: 'acme_corp' }
					]
				})
		).toThrow(ConfigurationInputIsInvalidException);
	});

	it('should throw when two instances are both explicitly legacy', () => {
		expect(
			() =>
				new InstanceRegistry({
					instances: [
						{ instanceId: 'a', vendorId: VENDOR_A, schemaPrefix: '' },
						{ instanceId: 'b', vendorId: VENDOR_B, schemaPrefix: '' }
					]
				})
		).toThrow(ConfigurationInputIsInvalidException);
	});

	it('should throw when defaultInstanceId is not a configured instance', () => {
		expect(() => new InstanceRegistry({ instances: [{ instanceId: 'a', vendorId: VENDOR_A }] }, 'missing')).toThrow(
			ConfigurationInputIsInvalidException
		);
	});

	it('should take defaultInstanceId from the configuration object', () => {
		const registry = new InstanceRegistry({
			instances: [
				{ instanceId: 'a', vendorId: VENDOR_A },
				{ instanceId: 'b', vendorId: VENDOR_B }
			],
			defaultInstanceId: 'b'
		});

		expect(registry.defaultInstanceId).toBe('b');
	});

	it('should validate a defaultInstanceId given on the configuration object', () => {
		expect(
			() =>
				new InstanceRegistry({
					instances: [{ instanceId: 'a', vendorId: VENDOR_A }],
					defaultInstanceId: 'missing'
				})
		).toThrow(ConfigurationInputIsInvalidException);
	});

	it('should accept a defaultInstanceId that is configured', () => {
		const registry = new InstanceRegistry({ instances: [{ instanceId: 'a', vendorId: VENDOR_A }] }, 'a');

		expect(registry.defaultInstanceId).toBe('a');
	});
});
