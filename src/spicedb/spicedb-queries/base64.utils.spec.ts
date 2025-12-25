import { encodeObjectId, decodeObjectId } from './base64.utils';

describe('base64.utils', () => {
	describe('encodeObjectId', () => {
		it('should encode simple string to base64', () => {
			const result = encodeObjectId('user-123');
			expect(result).toBe('dXNlci0xMjM');
		});

		it('should produce URL-safe base64 (no +, /, or =)', () => {
			// This string when base64 encoded would normally contain + and /
			const result = encodeObjectId('test+data/with=special');
			expect(result).not.toContain('+');
			expect(result).not.toContain('/');
			expect(result).not.toContain('=');
		});

		it('should replace + with -', () => {
			// Force a scenario that produces + in base64
			const input = '>>>'; // base64: Pj4+ (contains +)
			const result = encodeObjectId(input);
			expect(result).not.toContain('+');
			expect(result).toContain('-'); // + should be replaced with -
		});

		it('should replace / with _', () => {
			// Force a scenario that produces / in base64
			const input = '???'; // base64: Pz8/ (contains /)
			const result = encodeObjectId(input);
			expect(result).not.toContain('/');
			expect(result).toContain('_'); // / should be replaced with _
		});

		it('should handle empty string', () => {
			const result = encodeObjectId('');
			expect(result).toBe('');
		});

		it('should handle real customer data IDs', () => {
			const result = encodeObjectId('user-1-DWdTPCoH');
			expect(typeof result).toBe('string');
			expect(result.length).toBeGreaterThan(0);
		});
	});

	describe('decodeObjectId', () => {
		it('should decode base64 to original string', () => {
			const encoded = encodeObjectId('user-123');
			const decoded = decodeObjectId(encoded);
			expect(decoded).toBe('user-123');
		});

		it('should handle URL-safe base64 characters', () => {
			// Encode something that produces + and /
			const original = '>>>';
			const encoded = encodeObjectId(original);
			const decoded = decodeObjectId(encoded);
			expect(decoded).toBe(original);
		});

		it('should roundtrip any string correctly', () => {
			const testCases = [
				'user-1-DWdTPCoH',
				'doc-1-aOD3DYIF',
				'group-15-2FyCyAMR',
				'sub-100-XcpmSEUD',
				'test+special/chars=here',
				'unicode: 日本語'
			];

			for (const original of testCases) {
				const encoded = encodeObjectId(original);
				const decoded = decodeObjectId(encoded);
				expect(decoded).toBe(original);
			}
		});

		it('should handle empty string', () => {
			const result = decodeObjectId('');
			expect(result).toBe('');
		});

		it('should handle base64 strings from SpiceDB export', () => {
			// Real example from the yaml: Z3JvdXAtMS02MWRrNlRpYw = group-1-61dk6Tic
			const decoded = decodeObjectId('Z3JvdXAtMS02MWRrNlRpYw');
			expect(decoded).toBe('group-1-61dk6Tic');
		});

		it('should handle base64 user IDs from SpiceDB export', () => {
			// Real example: dXNlci0xLURXZFRQQ29I = user-1-DWdTPCoH
			const decoded = decodeObjectId('dXNlci0xLURXZFRQQ29I');
			expect(decoded).toBe('user-1-DWdTPCoH');
		});
	});

	describe('encode/decode symmetry', () => {
		it('should decode what encode produces', () => {
			const originals = [
				'simple',
				'with-dashes',
				'with_underscores',
				'with.dots',
				'CamelCase',
				'123456',
				'mixed-123_test.case'
			];

			for (const original of originals) {
				expect(decodeObjectId(encodeObjectId(original))).toBe(original);
			}
		});
	});
});

