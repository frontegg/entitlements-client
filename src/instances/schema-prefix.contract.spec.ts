import { randomUUID } from 'node:crypto';
import { deriveSchemaPrefix } from './schema-prefix.utils';

const DERIVED_PREFIXES: [string, string, string][] = [
	['a lowercase uuid', '2f9c1a44-7b0e-4a1e-9f8a-1c2d3e4f5a6b', 'v_2f9c1a44_7b0e_4a1e_9f8a_1c2d3e4f5a6b'],
	[
		'a lowercase uuid starting with a letter',
		'b81d0e77-3c5a-4f2b-9d6e-7a8b9c0d1e2f',
		'v_b81d0e77_3c5a_4f2b_9d6e_7a8b9c0d1e2f'
	],
	['the nil uuid', '00000000-0000-0000-0000-000000000000', 'v_00000000_0000_0000_0000_000000000000'],
	['a non-uuid id', 'acme-corp', 'v_acme_corp'],
	['a leading digit', '1acme', 'v_1acme'],
	['a single letter', 'a', 'v_a'],
	['a single digit', '7', 'v_7'],
	['a leading dash', '-acme', 'v__acme'],
	['two dashes in a row', 'acme--corp', 'v_acme__corp'],
	['61 characters, the longest', 'a'.repeat(61), `v_${'a'.repeat(61)}`],
	[
		'61 characters with dashes',
		`2f9c1a44-7b0e-4a1e-9f8a-1c2d3e4f5a6b-${'b'.repeat(24)}`,
		`v_2f9c1a44_7b0e_4a1e_9f8a_1c2d3e4f5a6b_${'b'.repeat(24)}`
	]
];

const REJECTED_VENDOR_IDS: [string, string][] = [
	['62 characters', 'a'.repeat(62)],
	['62 characters with dashes', `2f9c1a44-7b0e-4a1e-9f8a-1c2d3e4f5a6b-${'b'.repeat(25)}`],
	['an uppercase uuid', '2F9C1A44-7B0E-4A1E-9F8A-1C2D3E4F5A6B'],
	['one uppercase letter', 'Acme-corp'],
	['an underscore', 'acme_corp'],
	['a trailing dash', 'acme-'],
	['an empty string', ''],
	['a slash', 'has/slash'],
	['a space', 'acme corp'],
	['a dot', 'acme.co'],
	['a non-ascii letter', 'acmé-corp'],
	['an astral character', 'acme-\u{1d4b6}'],
	['a trailing newline', 'acme\n']
];

describe('FR-26219 shared vendorId to schema prefix contract, identical in entitlements-client, e10-engine-sync and entitlements-service', () => {
	it.each(DERIVED_PREFIXES)('should derive the prefix of %s', (_label, vendorId, prefix) => {
		expect(deriveSchemaPrefix(vendorId)).toBe(prefix);
	});

	it.each(REJECTED_VENDOR_IDS)('should reject a vendorId with %s', (_label, vendorId) => {
		expect(deriveSchemaPrefix(vendorId)).toBeUndefined();
	});

	it('should derive v_ and the id with every dash as an underscore for a random lowercase uuid', () => {
		const vendorId = randomUUID();

		expect(deriveSchemaPrefix(vendorId)).toBe(`v_${vendorId.split('-').join('_')}`);
	});
});
