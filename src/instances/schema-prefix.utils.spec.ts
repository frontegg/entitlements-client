import { v1 } from '@authzed/authzed-node';
import { SCHEMA_PREFIX, SPICEDB_OBJECT_TYPE } from './instance.constants';
import { deriveSchemaPrefix } from './schema-prefix.utils';

describe('schema-prefix', () => {
	describe(deriveSchemaPrefix.name, () => {
		it('should derive a prefix from a lowercase uuid vendorId', () => {
			expect(deriveSchemaPrefix('2f9c1a44-7b0e-4a1e-9f8a-1c2d3e4f5a6b')).toBe(
				'v_2f9c1a44_7b0e_4a1e_9f8a_1c2d3e4f5a6b'
			);
		});

		it('should derive a prefix from a lowercase non-uuid vendorId', () => {
			expect(deriveSchemaPrefix('acme-corp')).toBe('v_acme_corp');
		});

		it('should derive a prefix from a single character vendorId', () => {
			expect(deriveSchemaPrefix('a')).toBe('v_a');
		});

		it('should derive the longest prefix SpiceDB allows', () => {
			expect(deriveSchemaPrefix('a'.repeat(61))).toBe(`v_${'a'.repeat(61)}`);
		});

		it.each([
			['an uppercase uuid', '2F9C1A44-7B0E-4A1E-9F8A-1C2D3E4F5A6B'],
			['an uppercase letter', 'Acme-corp'],
			['an underscore', 'acme_corp'],
			['a slash', 'has/slash'],
			['a space', 'acme corp'],
			['a non-ascii letter', 'acmé-corp'],
			['an astral character', 'acme-\u{1d4b6}'],
			['a trailing dash', 'acme-'],
			['an empty string', ''],
			['a prefix one character too long for SpiceDB', 'a'.repeat(62)]
		])('should not derive a prefix from a vendorId with %s', (_case, vendorId) => {
			expect(deriveSchemaPrefix(vendorId)).toBeUndefined();
		});
	});

	describe('SCHEMA_PREFIX', () => {
		it('should accept a uuid-derived prefix', () => {
			expect(SCHEMA_PREFIX.test('v_2f9c1a44_7b0e_4a1e_9f8a_1c2d3e4f5a6b')).toBe(true);
		});

		it('should accept the longest prefix SpiceDB allows before the separator', () => {
			expect(SCHEMA_PREFIX.test(`v${'a'.repeat(62)}`)).toBe(true);
		});

		it('should reject a prefix one character too long for SpiceDB', () => {
			expect(SCHEMA_PREFIX.test(`v${'a'.repeat(63)}`)).toBe(false);
		});

		it.each([[''], ['V_UPPER'], ['_leading_underscore'], ['has/slash'], ['ends_with_'], ['ab']])(
			'should reject %j',
			(prefix) => {
				expect(SCHEMA_PREFIX.test(prefix)).toBe(false);
			}
		);
	});

	describe('SPICEDB_OBJECT_TYPE', () => {
		it('should be the object type pattern authzed-node publishes for SpiceDB', () => {
			const objectType = v1.ObjectReference.fields.find((field) => field.name === 'object_type');
			const publishedPattern = SPICEDB_OBJECT_TYPE.source.split('\\/').join('/');

			expect(objectType?.options).toMatchObject({
				'buf.validate.field': { string: { pattern: publishedPattern } },
				'validate.rules': { string: { pattern: publishedPattern } }
			});
		});

		it('should accept the longest name SpiceDB allows after the separator', () => {
			expect(SPICEDB_OBJECT_TYPE.test(`d${'a'.repeat(63)}`)).toBe(true);
		});

		it('should reject a name one character too long for SpiceDB', () => {
			expect(SPICEDB_OBJECT_TYPE.test(`d${'a'.repeat(64)}`)).toBe(false);
		});

		it('should read a slash as the end of a prefix, not as part of a name', () => {
			expect(SPICEDB_OBJECT_TYPE.test('has/slash')).toBe(true);
			expect(SPICEDB_OBJECT_TYPE.test('ha/slash')).toBe(false);
		});

		it.each([[''], ['V_UPPER'], ['_leading_underscore'], ['1leading_digit'], ['ends_with_'], ['ab'], ['a-b']])(
			'should reject %j',
			(name) => {
				expect(SPICEDB_OBJECT_TYPE.test(name)).toBe(false);
			}
		);
	});
});
