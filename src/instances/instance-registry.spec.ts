import { InstanceRegistry } from './instance-registry';
import { LEGACY_INSTANCE_ID } from './instance.constants';
import { InstanceConfiguration } from './instance.types';
import { ConfigurationInputIsInvalidException } from '../exceptions/configuration-input-is-invalid.exception';
import { ConfigurationInputIsMissingException } from '../exceptions/configuration-input-is-missing.exception';

const VENDOR_A = '2f9c1a44-7b0e-4a1e-9f8a-1c2d3e4f5a6b';
const VENDOR_B = '8b1d0e77-3c5a-4f2b-9d6e-7a8b9c0d1e2f';

describe(InstanceRegistry.name, () => {
	describe('legacy', () => {
		it.each([
			['omitted', {}],
			['undefined', { instances: undefined }],
			['null', { instances: null }]
		])('should synthesise a legacy instance when instances is %s', (_case, configuration) => {
			const registry = new InstanceRegistry(configuration);

			expect(registry.instanceIds).toEqual([]);
			expect(registry.implicitInstance?.namespace.isLegacy).toBe(true);
			expect(registry.implicitInstance?.namespace.instanceId).toBe(LEGACY_INSTANCE_ID);
		});

		it('should reject an explicitly empty instances list', () => {
			const construct = (): InstanceRegistry => new InstanceRegistry({ instances: [] });

			expect(construct).toThrow(ConfigurationInputIsInvalidException);
			expect(construct).toThrow('instances must not be empty; omit it for an unprefixed client');
		});

		it('should say no instances are configured when a defaultInstanceId is set without instances', () => {
			const construct = (): InstanceRegistry => new InstanceRegistry({ defaultInstanceId: 'eu' });

			expect(construct).toThrow(ConfigurationInputIsInvalidException);
			expect(construct).toThrow("defaultInstanceId 'eu' is set but no instances are configured");
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
			).toThrow("schemaPrefix must not be empty for instance 'a'");
		});

		it('should reject an invalid explicit schemaPrefix and name the rule', () => {
			const construct = (): InstanceRegistry =>
				new InstanceRegistry({
					instances: [{ instanceId: 'a', vendorId: VENDOR_A, schemaPrefix: 'Not/Valid' }]
				});

			expect(construct).toThrow(ConfigurationInputIsInvalidException);
			expect(construct).toThrow("Invalid schemaPrefix 'Not/Valid'");
			expect(construct).toThrow('starting with a-z');
		});

		it('should blame the vendorId when a derived prefix is invalid', () => {
			const construct = (): InstanceRegistry =>
				new InstanceRegistry({ instances: [{ instanceId: 'a', vendorId: 'acme corp' }] });

			expect(construct).toThrow(ConfigurationInputIsInvalidException);
			expect(construct).toThrow("derived from vendorId 'acme corp'");
			expect(construct).toThrow('set schemaPrefix explicitly');
		});

		it.each([
			[
				'two explicit overrides collide',
				{ instanceId: 'a', vendorId: VENDOR_A, schemaPrefix: 'shared_ns' },
				{ instanceId: 'b', vendorId: VENDOR_B, schemaPrefix: 'shared_ns' },
				"Duplicate schemaPrefix 'shared_ns' on instances 'a' and 'b'"
			],
			[
				'two vendorIds normalise to the same prefix',
				{ instanceId: 'a', vendorId: 'ACME-CORP' },
				{ instanceId: 'b', vendorId: 'acme_corp' },
				"Duplicate schemaPrefix 'v_acme_corp' on instances 'a' and 'b'"
			]
		])('should reject a shared namespace when %s', (_case, first, second, message) => {
			const construct = (): InstanceRegistry => new InstanceRegistry({ instances: [first, second] });

			expect(construct).toThrow(ConfigurationInputIsInvalidException);
			expect(construct).toThrow(message);
		});
	});

	describe('required fields', () => {
		it.each<[string, InstanceConfiguration[], string]>([
			[
				'with its vendorId',
				[{ instanceId: '', vendorId: VENDOR_A }],
				`instanceId is required for instances[0] (vendorId '${VENDOR_A}')`
			],
			[
				'by position alone',
				[
					{ instanceId: 'a', vendorId: VENDOR_A },
					{ instanceId: '', vendorId: '' }
				],
				'instanceId is required for instances[1]'
			]
		])('should name the entry missing an instanceId %s', (_case, instances, message) => {
			const construct = (): InstanceRegistry => new InstanceRegistry({ instances });

			expect(construct).toThrow(ConfigurationInputIsMissingException);
			expect(construct).toThrow(message);
		});

		it('should throw on a missing vendorId', () => {
			expect(() => new InstanceRegistry({ instances: [{ instanceId: 'a', vendorId: '' }] })).toThrow(
				ConfigurationInputIsMissingException
			);
		});

		it.each([
			[
				'instanceId',
				{ instanceId: 'a', vendorId: VENDOR_A },
				{ instanceId: 'a', vendorId: VENDOR_B },
				"Duplicate instanceId 'a'"
			],
			[
				'vendorId',
				{ instanceId: 'a', vendorId: VENDOR_A },
				{ instanceId: 'b', vendorId: VENDOR_A },
				`Duplicate vendorId '${VENDOR_A}' on instances 'a' and 'b'`
			]
		])('should throw on a duplicate %s', (_field, first, second, message) => {
			const construct = (): InstanceRegistry => new InstanceRegistry({ instances: [first, second] });

			expect(construct).toThrow(ConfigurationInputIsInvalidException);
			expect(construct).toThrow(message);
		});
	});

	describe('defaultInstanceId', () => {
		it.each([['missing'], ['']])('should throw when defaultInstanceId %j is not a configured instance', (id) => {
			const construct = (): InstanceRegistry =>
				new InstanceRegistry({
					instances: [
						{ instanceId: 'a', vendorId: VENDOR_A },
						{ instanceId: 'b', vendorId: VENDOR_B }
					],
					defaultInstanceId: id
				});

			expect(construct).toThrow(ConfigurationInputIsInvalidException);
			expect(construct).toThrow(`defaultInstanceId '${id}' is not one of the configured instances: a, b`);
		});

		it('should make the default the implicit instance', () => {
			const registry = new InstanceRegistry({
				instances: [
					{ instanceId: 'a', vendorId: VENDOR_A },
					{ instanceId: 'b', vendorId: VENDOR_B }
				],
				defaultInstanceId: 'b'
			});

			expect(registry.implicitInstance?.instanceId).toBe('b');
		});

		it('should make a single instance the implicit instance without a default', () => {
			const registry = new InstanceRegistry({ instances: [{ instanceId: 'a', vendorId: VENDOR_A }] });

			expect(registry.implicitInstance?.instanceId).toBe('a');
		});

		it('should treat a null defaultInstanceId as unset', () => {
			const single = new InstanceRegistry({
				instances: [{ instanceId: 'a', vendorId: VENDOR_A }],
				defaultInstanceId: null
			});
			const pair = new InstanceRegistry({
				instances: [
					{ instanceId: 'a', vendorId: VENDOR_A },
					{ instanceId: 'b', vendorId: VENDOR_B }
				],
				defaultInstanceId: null
			});

			expect(single.implicitInstance?.instanceId).toBe('a');
			expect(pair.implicitInstance).toBeUndefined();
		});

		it('should have no implicit instance when several are configured without a default', () => {
			const registry = new InstanceRegistry({
				instances: [
					{ instanceId: 'a', vendorId: VENDOR_A },
					{ instanceId: 'b', vendorId: VENDOR_B }
				]
			});

			expect(registry.implicitInstance).toBeUndefined();
			expect(registry.instanceIds).toHaveLength(2);
		});
	});
});
