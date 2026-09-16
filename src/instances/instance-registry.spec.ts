import { InstanceRegistry, LEGACY_INSTANCE_ID } from './instance-registry';
import { ConfigurationInputIsInvalidException } from '../exceptions/configuration-input-is-invalid.exception';
import { ConfigurationInputIsMissingException } from '../exceptions/configuration-input-is-missing.exception';

const VENDOR_A = '2f9c1a44-7b0e-4a1e-9f8a-1c2d3e4f5a6b';
const VENDOR_B = '8b1d0e77-3c5a-4f2b-9d6e-7a8b9c0d1e2f';

describe(InstanceRegistry.name, () => {
	describe('legacy', () => {
		it.each([[{}], [{ instances: [] }]])('should synthesise a legacy instance for %j', (configuration) => {
			const registry = new InstanceRegistry(configuration);

			expect(registry.instanceIds).toEqual([LEGACY_INSTANCE_ID]);
			expect(registry.implicitInstance?.namespace.isLegacy).toBe(true);
			expect(registry.implicitInstance?.namespace.instanceId).toBe(LEGACY_INSTANCE_ID);
		});
	});

	describe('prefixes', () => {
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
			expect(registry.get('a')?.namespace.instanceId).toBe('a');
		});

		it('should reject an empty schemaPrefix inside a populated instances list', () => {
			expect(
				() => new InstanceRegistry({ instances: [{ instanceId: 'a', vendorId: VENDOR_A, schemaPrefix: '' }] })
			).toThrow(/must not be empty/);
		});

		it('should reject an invalid explicit schemaPrefix and name the rule', () => {
			const construct = (): InstanceRegistry =>
				new InstanceRegistry({
					instances: [{ instanceId: 'a', vendorId: VENDOR_A, schemaPrefix: 'Not/Valid' }]
				});

			expect(construct).toThrow(ConfigurationInputIsInvalidException);
			expect(construct).toThrow(/Invalid schemaPrefix 'Not\/Valid'.*starting with a-z/);
		});

		it('should blame the vendorId when a derived prefix is invalid', () => {
			const construct = (): InstanceRegistry =>
				new InstanceRegistry({ instances: [{ instanceId: 'a', vendorId: 'acme corp' }] });

			expect(construct).toThrow(ConfigurationInputIsInvalidException);
			expect(construct).toThrow(/derived from vendorId 'acme corp'.*set schemaPrefix explicitly/);
		});

		it.each([
			[
				'two explicit overrides collide',
				{ instanceId: 'a', vendorId: VENDOR_A, schemaPrefix: 'shared_ns' },
				{ instanceId: 'b', vendorId: VENDOR_B, schemaPrefix: 'shared_ns' }
			],
			[
				'two vendorIds normalise to the same prefix',
				{ instanceId: 'a', vendorId: 'ACME-CORP' },
				{ instanceId: 'b', vendorId: 'acme_corp' }
			]
		])('should reject a shared namespace when %s', (_case, first, second) => {
			const construct = (): InstanceRegistry => new InstanceRegistry({ instances: [first, second] });

			expect(construct).toThrow(ConfigurationInputIsInvalidException);
			expect(construct).toThrow(/Duplicate schemaPrefix/);
		});
	});

	describe('required fields', () => {
		it('should throw on a missing instanceId', () => {
			expect(() => new InstanceRegistry({ instances: [{ instanceId: '', vendorId: VENDOR_A }] })).toThrow(
				ConfigurationInputIsMissingException
			);
		});

		it('should throw on a missing vendorId', () => {
			expect(() => new InstanceRegistry({ instances: [{ instanceId: 'a', vendorId: '' }] })).toThrow(
				ConfigurationInputIsMissingException
			);
		});

		it.each([
			['instanceId', { instanceId: 'a', vendorId: VENDOR_A }, { instanceId: 'a', vendorId: VENDOR_B }],
			['vendorId', { instanceId: 'a', vendorId: VENDOR_A }, { instanceId: 'b', vendorId: VENDOR_A }]
		])('should throw on a duplicate %s', (field, first, second) => {
			const construct = (): InstanceRegistry => new InstanceRegistry({ instances: [first, second] });

			expect(construct).toThrow(ConfigurationInputIsInvalidException);
			expect(construct).toThrow(new RegExp(`Duplicate ${field}`));
		});
	});

	describe('defaultInstanceId', () => {
		it('should throw when defaultInstanceId is not a configured instance', () => {
			expect(
				() =>
					new InstanceRegistry({
						instances: [{ instanceId: 'a', vendorId: VENDOR_A }],
						defaultInstanceId: 'missing'
					})
			).toThrow(ConfigurationInputIsInvalidException);
		});

		it('should make the default the implicit instance', () => {
			const registry = new InstanceRegistry({
				instances: [
					{ instanceId: 'a', vendorId: VENDOR_A },
					{ instanceId: 'b', vendorId: VENDOR_B }
				],
				defaultInstanceId: 'b'
			});

			expect(registry.defaultInstanceId).toBe('b');
			expect(registry.implicitInstance?.instanceId).toBe('b');
		});

		it('should make a single instance the implicit instance without a default', () => {
			const registry = new InstanceRegistry({ instances: [{ instanceId: 'a', vendorId: VENDOR_A }] });

			expect(registry.implicitInstance?.instanceId).toBe('a');
		});

		it('should have no implicit instance when several are configured without a default', () => {
			const registry = new InstanceRegistry({
				instances: [
					{ instanceId: 'a', vendorId: VENDOR_A },
					{ instanceId: 'b', vendorId: VENDOR_B }
				]
			});

			expect(registry.implicitInstance).toBeUndefined();
			expect(registry.size).toBe(2);
		});
	});
});
