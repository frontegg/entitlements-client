import { SchemaNamespace } from './schema-namespace';
import { ConfigurationInputIsInvalidException } from '../exceptions/configuration-input-is-invalid.exception';
import { InvalidObjectTypeException } from '../exceptions/invalid-object-type.exception';

const PREFIX = 'v_2f9c1a44_7b0e_4a1e_9f8a_1c2d3e4f5a6b';

describe(SchemaNamespace.name, () => {
	describe('prefixed namespace', () => {
		const namespace = SchemaNamespace.prefixed(PREFIX, 'eu');

		it('should report it is not legacy', () => {
			expect(namespace.isLegacy).toBe(false);
			expect(namespace.schemaPrefix).toBe(PREFIX);
			expect(namespace.instanceId).toBe('eu');
		});

		it('should prefix an object type', () => {
			expect(namespace.type('frontegg_feature')).toBe(`${PREFIX}/frontegg_feature`);
		});

		it('should reject an object type that already contains a prefix separator', () => {
			expect(() => namespace.type('v_other/document')).toThrow(InvalidObjectTypeException);
		});

		it('should name the offending object type in the error', () => {
			expect(() => namespace.type('v_other/document')).toThrow(
				"Object type 'v_other/document' must not contain '/'. Schema prefixes are applied by the SDK."
			);
			expect(() => namespace.type('v_other/document')).toThrow(
				expect.objectContaining({ name: 'InvalidObjectTypeException', objectType: 'v_other/document' })
			);
		});

		it.each([[''], ['V_UPPER'], ['has/slash'], ['ends_with_']])('should refuse the schema prefix %j', (prefix) => {
			const construct = (): SchemaNamespace => SchemaNamespace.prefixed(prefix, 'eu');

			expect(construct).toThrow(ConfigurationInputIsInvalidException);
			expect(construct).toThrow(`Invalid schema prefix '${prefix}' for instance 'eu'`);
		});
	});

	describe('legacy namespace', () => {
		const namespace = SchemaNamespace.legacy('legacy');

		it('should report it is legacy', () => {
			expect(namespace.isLegacy).toBe(true);
			expect(namespace.schemaPrefix).toBe('');
			expect(namespace.instanceId).toBe('legacy');
		});

		it('should return the object type unchanged', () => {
			expect(namespace.type('frontegg_feature')).toBe('frontegg_feature');
		});

		it('should pass a namespaced object type through, since that is valid SpiceDB syntax', () => {
			expect(namespace.type('acme/document')).toBe('acme/document');
		});
	});
});
