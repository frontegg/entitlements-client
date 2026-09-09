import { deriveSchemaPrefix, isValidSchemaPrefix } from './schema-prefix';

describe('schema-prefix', () => {
	describe(deriveSchemaPrefix.name, () => {
		it('should derive a prefix from a uuid vendorId', () => {
			expect(deriveSchemaPrefix('2f9c1a44-7b0e-4a1e-9f8a-1c2d3e4f5a6b')).toBe(
				'v_2f9c1a44_7b0e_4a1e_9f8a_1c2d3e4f5a6b'
			);
		});

		it('should lowercase an uppercase vendorId', () => {
			expect(deriveSchemaPrefix('2F9C1A44-7B0E-4A1E-9F8A-1C2D3E4F5A6B')).toBe(
				'v_2f9c1a44_7b0e_4a1e_9f8a_1c2d3e4f5a6b'
			);
		});

		it('should handle a non-uuid vendorId', () => {
			expect(deriveSchemaPrefix('acme-corp')).toBe('v_acme_corp');
		});
	});

	describe(isValidSchemaPrefix.name, () => {
		it('should accept the empty legacy prefix', () => {
			expect(isValidSchemaPrefix('')).toBe(true);
		});

		it('should accept a derived prefix', () => {
			expect(isValidSchemaPrefix(deriveSchemaPrefix('2f9c1a44-7b0e-4a1e-9f8a-1c2d3e4f5a6b'))).toBe(true);
		});

		it.each([
			['V_UPPER'],
			['1leading_digit'],
			['has/slash'],
			['ends_with_'],
			['ab'],
			['_leading_underscore'],
			[`v${'a'.repeat(64)}`]
		])('should reject %s', (prefix) => {
			expect(isValidSchemaPrefix(prefix)).toBe(false);
		});

		it('should accept the longest prefix SpiceDB allows', () => {
			expect(isValidSchemaPrefix(`v${'a'.repeat(63)}`)).toBe(true);
		});
	});
});
