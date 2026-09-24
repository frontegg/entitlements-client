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

		it.each([
			['an uppercase letter', 'ACME-CORP'],
			['an uppercase uuid', '2F9C1A44-7B0E-4A1E-9F8A-1C2D3E4F5A6B'],
			['an underscore', 'acme_corp'],
			['a space', 'acme corp'],
			['a non-ascii letter', 'acmé-corp'],
			['a trailing dash', 'acme-']
		])('should reject a vendorId with %s because it cannot become a SpiceDB prefix', (_case, vendorId) => {
			const construct = (): InstanceRegistry =>
				new InstanceRegistry({ instances: [{ instanceId: 'a', vendorId }] });

			expect(construct).toThrow(ConfigurationInputIsInvalidException);
			expect(construct).toThrow(`vendorId '${vendorId}' for instance 'a' cannot become a SpiceDB schema prefix`);
		});

		it('should reject an invalid vendorId before reporting a duplicate instanceId', () => {
			const construct = (): InstanceRegistry =>
				new InstanceRegistry({
					instances: [
						{ instanceId: 'a', vendorId: VENDOR_A },
						{ instanceId: 'a', vendorId: 'ACME' }
					]
				});

			expect(construct).toThrow("vendorId 'ACME' for instance 'a' cannot become a SpiceDB schema prefix");
		});

		it('should reject a vendorId that would alias the prefix another vendorId derives', () => {
			expect(
				() =>
					new InstanceRegistry({
						instances: [
							{ instanceId: 'a', vendorId: 'acme-corp' },
							{ instanceId: 'b', vendorId: 'acme_corp' }
						]
					})
			).toThrow("vendorId 'acme_corp' for instance 'b' cannot become a SpiceDB schema prefix");
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

		it.each([
			['a single character', 'a'],
			['a leading digit', '1eu'],
			['a dash and an underscore', 'eu-west_1'],
			['the longest allowed length', 'a'.repeat(63)]
		])('should accept an instanceId with %s', (_case, instanceId) => {
			const registry = new InstanceRegistry({ instances: [{ instanceId, vendorId: VENDOR_A }] });

			expect(registry.get(instanceId)?.instanceId).toBe(instanceId);
		});

		it.each([
			['a colon', 'a:b'],
			['a slash', 'a/b'],
			['a dot', 'a.b'],
			['a space', 'a b'],
			['a tab', 'a\tb'],
			['a newline', 'a\nb'],
			['a double quote', 'a"b'],
			['a single quote', "a'b"],
			['an uppercase letter', 'Eu'],
			['a non-ascii letter', 'eé'],
			['a leading dash', '-eu'],
			['a leading underscore', '_eu'],
			['more than 63 characters', 'a'.repeat(64)]
		])('should reject an instanceId with %s', (_case, instanceId) => {
			const construct = (): InstanceRegistry =>
				new InstanceRegistry({
					instances: [
						{ instanceId: 'a', vendorId: VENDOR_A },
						{ instanceId, vendorId: VENDOR_B }
					]
				});

			expect(construct).toThrow(ConfigurationInputIsInvalidException);
			expect(construct).toThrow(
				`instanceId ${JSON.stringify(instanceId)} on instances[1] is invalid; ` +
					"expected 1 to 63 characters containing only a-z, 0-9, '-' and '_', and starting with a-z or 0-9"
			);
		});

		it.each([
			[
				'a:b',
				[
					{ instanceId: 'a:b', vendorId: VENDOR_A },
					{ instanceId: 'x', vendorId: VENDOR_B }
				]
			],
			[
				'b:x',
				[
					{ instanceId: 'a', vendorId: VENDOR_A },
					{ instanceId: 'b:x', vendorId: VENDOR_B }
				]
			]
		])(
			'should reject %j so instanceIds joined with a colon can never build the same cache key',
			(instanceId, instances) => {
				expect(() => new InstanceRegistry({ instances })).toThrow(
					`instanceId ${JSON.stringify(instanceId)} on instances`
				);
			}
		);

		it('should escape a newline in the rejected instanceId so the message stays on one line', () => {
			const construct = (): InstanceRegistry =>
				new InstanceRegistry({ instances: [{ instanceId: 'eu\nforged', vendorId: VENDOR_A }] });

			expect(construct).toThrow('instanceId "eu\\nforged" on instances[0] is invalid');
			expect(construct).not.toThrow('\n');
		});

		it('should reject an instance that claims the reserved legacy instanceId', () => {
			const construct = (): InstanceRegistry =>
				new InstanceRegistry({ instances: [{ instanceId: LEGACY_INSTANCE_ID, vendorId: VENDOR_A }] });

			expect(construct).toThrow(ConfigurationInputIsInvalidException);
			expect(construct).toThrow("instanceId 'legacy' on instances[0] is reserved for the unprefixed client");
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
