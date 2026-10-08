import { randomUUID } from 'node:crypto';
import { InstanceRegistry } from './instance-registry';
import { LEGACY_INSTANCE_ID } from './instance.constants';
import { InstanceConfiguration } from './instance.types';
import { ConfigurationInputIsInvalidException } from '../exceptions/configuration-input-is-invalid.exception';
import { ConfigurationInputIsMissingException } from '../exceptions/configuration-input-is-missing.exception';

const VENDOR_A = randomUUID();
const VENDOR_B = randomUUID();
const INSTANCE_A = randomUUID();
const INSTANCE_B = randomUUID();
const UNKNOWN_INSTANCE = randomUUID();

const prefixOf = (vendorId: string): string => `v_${vendorId.split('-').join('_')}`;

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
			const construct = (): InstanceRegistry => new InstanceRegistry({ defaultInstanceId: INSTANCE_A });

			expect(construct).toThrow(ConfigurationInputIsInvalidException);
			expect(construct).toThrow(`defaultInstanceId '${INSTANCE_A}' is set but no instances are configured`);
		});
	});

	describe('prefixes', () => {
		it('should derive a schema prefix from each vendorId', () => {
			const registry = new InstanceRegistry({
				instances: [
					{ instanceId: INSTANCE_A, vendorId: VENDOR_A },
					{ instanceId: INSTANCE_B, vendorId: VENDOR_B }
				]
			});

			expect(registry.get(INSTANCE_A)?.namespace.schemaPrefix).toBe(prefixOf(VENDOR_A));
			expect(registry.get(INSTANCE_B)?.namespace.schemaPrefix).toBe(prefixOf(VENDOR_B));
		});

		it.each([
			['an uppercase letter', 'ACME-CORP'],
			['an uppercase uuid', VENDOR_A.toUpperCase()],
			['an underscore', VENDOR_A.split('-').join('_')],
			['a space', VENDOR_A.split('-').join(' ')],
			['a non-ascii letter', `${VENDOR_A}é`],
			['a trailing dash', `${VENDOR_A}-`]
		])('should reject a vendorId with %s because it cannot become a SpiceDB prefix', (_case, vendorId) => {
			const construct = (): InstanceRegistry =>
				new InstanceRegistry({ instances: [{ instanceId: INSTANCE_A, vendorId }] });

			expect(construct).toThrow(ConfigurationInputIsInvalidException);
			expect(construct).toThrow(
				`vendorId '${vendorId}' for instance '${INSTANCE_A}' cannot become a SpiceDB schema prefix`
			);
		});

		it('should reject an invalid vendorId before reporting a duplicate instanceId', () => {
			const construct = (): InstanceRegistry =>
				new InstanceRegistry({
					instances: [
						{ instanceId: INSTANCE_A, vendorId: VENDOR_A },
						{ instanceId: INSTANCE_A, vendorId: VENDOR_B.toUpperCase() }
					]
				});

			expect(construct).toThrow(
				`vendorId '${VENDOR_B.toUpperCase()}' for instance '${INSTANCE_A}' cannot become a SpiceDB schema prefix`
			);
		});

		it('should reject a vendorId that would alias the prefix another vendorId derives', () => {
			expect(
				() =>
					new InstanceRegistry({
						instances: [
							{ instanceId: INSTANCE_A, vendorId: VENDOR_A },
							{ instanceId: INSTANCE_B, vendorId: VENDOR_A.split('-').join('_') }
						]
					})
			).toThrow(
				`vendorId '${VENDOR_A.split('-').join('_')}' for instance '${INSTANCE_B}' cannot become a SpiceDB schema prefix`
			);
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
					{ instanceId: INSTANCE_A, vendorId: VENDOR_A },
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
			['a dash', 'eu-west-1'],
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
			['an underscore', 'a_b'],
			['more than 63 characters', 'a'.repeat(64)]
		])('should reject an instanceId with %s', (_case, instanceId) => {
			const construct = (): InstanceRegistry =>
				new InstanceRegistry({
					instances: [
						{ instanceId: INSTANCE_A, vendorId: VENDOR_A },
						{ instanceId, vendorId: VENDOR_B }
					]
				});

			expect(construct).toThrow(ConfigurationInputIsInvalidException);
			expect(construct).toThrow(
				`instanceId ${JSON.stringify(instanceId)} on instances[1] is invalid; ` +
					"expected 1 to 63 characters containing only a-z, 0-9 and '-', and starting with a-z or 0-9"
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
			expect(() => new InstanceRegistry({ instances: [{ instanceId: INSTANCE_A, vendorId: '' }] })).toThrow(
				ConfigurationInputIsMissingException
			);
		});

		it.each([
			[
				'instanceId',
				{ instanceId: INSTANCE_A, vendorId: VENDOR_A },
				{ instanceId: INSTANCE_A, vendorId: VENDOR_B },
				`Duplicate instanceId '${INSTANCE_A}'`
			],
			[
				'vendorId',
				{ instanceId: INSTANCE_A, vendorId: VENDOR_A },
				{ instanceId: INSTANCE_B, vendorId: VENDOR_A },
				`Duplicate vendorId '${VENDOR_A}' on instances '${INSTANCE_A}' and '${INSTANCE_B}'`
			]
		])('should throw on a duplicate %s', (_field, first, second, message) => {
			const construct = (): InstanceRegistry => new InstanceRegistry({ instances: [first, second] });

			expect(construct).toThrow(ConfigurationInputIsInvalidException);
			expect(construct).toThrow(message);
		});
	});

	describe('defaultInstanceId', () => {
		it.each([[UNKNOWN_INSTANCE], ['']])(
			'should throw when defaultInstanceId %j is not a configured instance',
			(id) => {
				const construct = (): InstanceRegistry =>
					new InstanceRegistry({
						instances: [
							{ instanceId: INSTANCE_A, vendorId: VENDOR_A },
							{ instanceId: INSTANCE_B, vendorId: VENDOR_B }
						],
						defaultInstanceId: id
					});

				expect(construct).toThrow(ConfigurationInputIsInvalidException);
				expect(construct).toThrow(
					`defaultInstanceId '${id}' is not one of the configured instances: ${INSTANCE_A}, ${INSTANCE_B}`
				);
			}
		);

		it('should make the default the implicit instance', () => {
			const registry = new InstanceRegistry({
				instances: [
					{ instanceId: INSTANCE_A, vendorId: VENDOR_A },
					{ instanceId: INSTANCE_B, vendorId: VENDOR_B }
				],
				defaultInstanceId: INSTANCE_B
			});

			expect(registry.implicitInstance?.instanceId).toBe(INSTANCE_B);
		});

		it('should make a single instance the implicit instance without a default', () => {
			const registry = new InstanceRegistry({ instances: [{ instanceId: INSTANCE_A, vendorId: VENDOR_A }] });

			expect(registry.implicitInstance?.instanceId).toBe(INSTANCE_A);
		});

		it('should treat a null defaultInstanceId as unset', () => {
			const single = new InstanceRegistry({
				instances: [{ instanceId: INSTANCE_A, vendorId: VENDOR_A }],
				defaultInstanceId: null
			});
			const pair = new InstanceRegistry({
				instances: [
					{ instanceId: INSTANCE_A, vendorId: VENDOR_A },
					{ instanceId: INSTANCE_B, vendorId: VENDOR_B }
				],
				defaultInstanceId: null
			});

			expect(single.implicitInstance?.instanceId).toBe(INSTANCE_A);
			expect(pair.implicitInstance).toBeUndefined();
		});

		it('should have no implicit instance when several are configured without a default', () => {
			const registry = new InstanceRegistry({
				instances: [
					{ instanceId: INSTANCE_A, vendorId: VENDOR_A },
					{ instanceId: INSTANCE_B, vendorId: VENDOR_B }
				]
			});

			expect(registry.implicitInstance).toBeUndefined();
			expect(registry.instanceIds).toHaveLength(2);
		});
	});
});
