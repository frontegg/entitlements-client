import { SchemaScope } from './schema-scope';
import { ConfigurationInputIsInvalidException } from '../exceptions/configuration-input-is-invalid.exception';

const PREFIX = 'v_2f9c1a44_7b0e_4a1e_9f8a_1c2d3e4f5a6b';

describe(SchemaScope.name, () => {
	describe('prefixed scope', () => {
		const scope = new SchemaScope(PREFIX);

		it('should report it is not legacy', () => {
			expect(scope.isLegacy).toBe(false);
			expect(scope.schemaPrefix).toBe(PREFIX);
		});

		it('should prefix an object type', () => {
			expect(scope.type('frontegg_feature')).toBe(`${PREFIX}/frontegg_feature`);
		});

		it('should round-trip type and strip', () => {
			expect(scope.strip(scope.type('document'))).toBe('document');
		});

		it('should leave a foreign prefix untouched when stripping', () => {
			expect(scope.strip('v_other/document')).toBe('v_other/document');
		});

		it('should reject an object type that already contains a prefix separator', () => {
			expect(() => scope.type('v_other/document')).toThrow(ConfigurationInputIsInvalidException);
		});
	});

	describe('legacy scope', () => {
		const scope = new SchemaScope('');

		it('should report it is legacy', () => {
			expect(scope.isLegacy).toBe(true);
			expect(scope.schemaPrefix).toBe('');
		});

		it('should return the object type unchanged', () => {
			expect(scope.type('frontegg_feature')).toBe('frontegg_feature');
			expect(scope.strip('frontegg_feature')).toBe('frontegg_feature');
		});

		it('should still reject an object type containing a prefix separator', () => {
			expect(() => scope.type('v_other/document')).toThrow(ConfigurationInputIsInvalidException);
		});
	});
});
