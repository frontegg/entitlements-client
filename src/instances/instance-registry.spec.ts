import { InstanceRegistry, LEGACY_INSTANCE_ID } from './instance-registry';
import { ConfigurationInputIsInvalidException } from '../exceptions/configuration-input-is-invalid.exception';

const VENDOR_A = '2f9c1a44-7b0e-4a1e-9f8a-1c2d3e4f5a6b';
const VENDOR_B = '8b1d0e77-3c5a-4f2b-9d6e-7a8b9c0d1e2f';

describe(InstanceRegistry.name, () => {
	it('should synthesise a legacy instance when no instances are configured', () => {
		const registry = new InstanceRegistry({});

		expect(registry.size).toBe(1);
		expect(registry.instanceIds).toEqual([LEGACY_INSTANCE_ID]);
		expect(registry.onlyInstance.scope.isLegacy).toBe(true);
	});

	it('should synthesise a legacy instance for an empty instances array', () => {
		const registry = new InstanceRegistry({ instances: [] });

		expect(registry.onlyInstance.scope.isLegacy).toBe(true);
	});

	it('should derive a schema prefix from each vendorId', () => {
		const registry = new InstanceRegistry({
			instances: [
				{ instanceId: 'a', vendorId: VENDOR_A },
				{ instanceId: 'b', vendorId: VENDOR_B }
			]
		});

		expect(registry.get('a')?.scope.schemaPrefix).toBe('v_2f9c1a44_7b0e_4a1e_9f8a_1c2d3e4f5a6b');
		expect(registry.get('b')?.scope.schemaPrefix).toBe('v_8b1d0e77_3c5a_4f2b_9d6e_7a8b9c0d1e2f');
	});

	it('should honour an explicit schemaPrefix override', () => {
		const registry = new InstanceRegistry({
			instances: [{ instanceId: 'a', vendorId: VENDOR_A, schemaPrefix: 'v_custom' }]
		});

		expect(registry.get('a')?.scope.schemaPrefix).toBe('v_custom');
	});

	it('should treat an explicit empty schemaPrefix as legacy', () => {
		const registry = new InstanceRegistry({
			instances: [{ instanceId: 'a', vendorId: VENDOR_A, schemaPrefix: '' }]
		});

		expect(registry.get('a')?.scope.isLegacy).toBe(true);
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

	it('should throw when defaultInstanceId is not a configured instance', () => {
		expect(() => new InstanceRegistry({ instances: [{ instanceId: 'a', vendorId: VENDOR_A }] }, 'missing')).toThrow(
			ConfigurationInputIsInvalidException
		);
	});

	it('should accept a defaultInstanceId that is configured', () => {
		const registry = new InstanceRegistry({ instances: [{ instanceId: 'a', vendorId: VENDOR_A }] }, 'a');

		expect(registry.defaultInstanceId).toBe('a');
	});
});
