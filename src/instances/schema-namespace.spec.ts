import { SchemaNamespace } from './schema-namespace';
import { InvalidObjectTypeException } from '../exceptions/invalid-object-type.exception';

const PREFIX = 'v_2f9c1a44_7b0e_4a1e_9f8a_1c2d3e4f5a6b';

describe(SchemaNamespace.name, () => {
	describe('prefixed namespace', () => {
		const namespace = new SchemaNamespace(PREFIX);

		it('should report it is not legacy', () => {
			expect(namespace.isLegacy).toBe(false);
			expect(namespace.schemaPrefix).toBe(PREFIX);
		});

		it('should prefix an object type', () => {
			expect(namespace.type('frontegg_feature')).toBe(`${PREFIX}/frontegg_feature`);
		});

		it('should round-trip type and strip', () => {
			expect(namespace.strip(namespace.type('document'))).toBe('document');
		});

		it('should leave a foreign prefix untouched when stripping', () => {
			expect(namespace.strip('v_other/document')).toBe('v_other/document');
		});

		it('should reject an object type that already contains a prefix separator', () => {
			expect(() => namespace.type('v_other/document')).toThrow(InvalidObjectTypeException);
		});
	});

	describe('legacy namespace', () => {
		const namespace = new SchemaNamespace('');

		it('should report it is legacy', () => {
			expect(namespace.isLegacy).toBe(true);
			expect(namespace.schemaPrefix).toBe('');
		});

		it('should return the object type unchanged', () => {
			expect(namespace.type('frontegg_feature')).toBe('frontegg_feature');
			expect(namespace.strip('frontegg_feature')).toBe('frontegg_feature');
		});

		it('should pass a namespaced object type through, since that is valid SpiceDB syntax', () => {
			expect(namespace.type('acme/document')).toBe('acme/document');
		});
	});
});
