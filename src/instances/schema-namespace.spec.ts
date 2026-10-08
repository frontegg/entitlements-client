import { SchemaNamespace } from './schema-namespace';
import { ConfigurationInputIsInvalidException } from '../exceptions/configuration-input-is-invalid.exception';
import { InvalidObjectTypeException } from '../exceptions/invalid-object-type.exception';
import { CallerInputException } from '../exceptions/caller-input.exception';

const PREFIX = 'v_2f9c1a44_7b0e_4a1e_9f8a_1c2d3e4f5a6b';

const INVALID_OBJECT_TYPES = [['Document'], ['my-entity'], ['1document'], [''], ['a'], ['a'.repeat(65)]];

const LONGEST_NAME = 'a'.repeat(64);

const LONGEST_PREFIX_SEGMENT = 'a'.repeat(63);

const SYNCER_ACCEPTED_TYPE_PATHS = [['document'], ['acme/document'], ['acme/billing/document']];

const SYNCER_REJECTED_TYPE_PATHS = [
	['v_x/a/b', "Object type 'v_x/a/b' must not start with the reserved vendor schema prefix 'v_'."],
	[
		'acme//document',
		"Object type 'acme//document' is not a valid SpiceDB name; its prefix '' must be 3 to 63 characters"
	],
	['/document', "Object type '/document' is not a valid SpiceDB name; its prefix '' must be 3 to 63 characters"],
	['document/', "Object type 'document/' is not a valid SpiceDB name; its name '' must be 3 to 64 characters"]
];

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

		it('should accept the longest object type name SpiceDB allows', () => {
			expect(namespace.type(LONGEST_NAME)).toBe(`${PREFIX}/${LONGEST_NAME}`);
		});

		it('should accept the longest object type name behind a short prefix', () => {
			expect(SchemaNamespace.prefixed('v_abc', 'eu').type(LONGEST_NAME)).toBe(`v_abc/${LONGEST_NAME}`);
		});

		it('should name the object type bound when the name is one character too long', () => {
			expect(() => namespace.type(`${LONGEST_NAME}a`)).toThrow(
				`Object type '${LONGEST_NAME}a' is not a valid SpiceDB name; expected 3 to 64 characters`
			);
		});

		it('should accept the longest schema prefix SpiceDB allows', () => {
			const longest = `v_${'a'.repeat(61)}`;

			expect(SchemaNamespace.prefixed(longest, 'eu').type('document')).toBe(`${longest}/document`);
		});

		it('should refuse a schema prefix one character too long and name the prefix bound', () => {
			const tooLong = `v_${'a'.repeat(62)}`;
			const construct = (): SchemaNamespace => SchemaNamespace.prefixed(tooLong, 'eu');

			expect(construct).toThrow(ConfigurationInputIsInvalidException);
			expect(construct).toThrow(
				`Invalid schema prefix '${tooLong}' for instance 'eu'; expected 3 to 63 characters`
			);
		});

		it('should reject an object type that already contains a prefix separator', () => {
			expect(() => namespace.type('v_other/document')).toThrow(InvalidObjectTypeException);
		});

		it('should raise the rejection as caller input so every read path fails closed on it', () => {
			expect(() => namespace.type('v_other/document')).toThrow(expect.any(CallerInputException));
		});

		it('should name the offending object type in the error', () => {
			expect(() => namespace.type('v_other/document')).toThrow(
				"Object type 'v_other/document' must not contain '/'. Schema prefixes are applied by the SDK."
			);
			expect(() => namespace.type('v_other/document')).toThrow(
				expect.objectContaining({ name: 'InvalidObjectTypeException', objectType: 'v_other/document' })
			);
		});

		it.each(INVALID_OBJECT_TYPES)('should reject the malformed object type %j', (objectType) => {
			const type = (): string => namespace.type(objectType);

			expect(type).toThrow(InvalidObjectTypeException);
			expect(type).toThrow(expect.any(CallerInputException));
			expect(type).toThrow(`Object type '${objectType}' is not a valid SpiceDB name`);
			expect(type).toThrow(expect.objectContaining({ name: 'InvalidObjectTypeException', objectType }));
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

		it.each(SYNCER_ACCEPTED_TYPE_PATHS)(
			'should pass the type path %j through, as the syncer guard does',
			(objectType) => {
				expect(namespace.type(objectType)).toBe(objectType);
			}
		);

		it.each(SYNCER_REJECTED_TYPE_PATHS)(
			'should reject the type path %j, as the syncer guard does',
			(objectType, message) => {
				const type = (): string => namespace.type(objectType);

				expect(type).toThrow(InvalidObjectTypeException);
				expect(type).toThrow(expect.any(CallerInputException));
				expect(type).toThrow(message);
				expect(type).toThrow(expect.objectContaining({ name: 'InvalidObjectTypeException', objectType }));
			}
		);

		it.each([['v_other/document'], ['v_acme/document']])(
			'should reject %j because it escapes into the reserved vendor schema prefix',
			(objectType) => {
				const type = (): string => namespace.type(objectType);

				expect(type).toThrow(InvalidObjectTypeException);
				expect(type).toThrow(expect.any(CallerInputException));
				expect(type).toThrow(
					`Object type '${objectType}' must not start with the reserved vendor schema prefix 'v_'.`
				);
				expect(type).toThrow(expect.objectContaining({ name: 'InvalidObjectTypeException', objectType }));
			}
		);

		it.each([['v_user'], ['v_account'], ['v_other']])(
			'should accept the plain name %j, which cannot escape another vendor namespace',
			(objectType) => {
				expect(namespace.type(objectType)).toBe(objectType);
			}
		);

		it.each(INVALID_OBJECT_TYPES)('should reject the malformed object type %j', (objectType) => {
			const type = (): string => namespace.type(objectType);

			expect(type).toThrow(InvalidObjectTypeException);
			expect(type).toThrow(expect.any(CallerInputException));
			expect(type).toThrow(`Object type '${objectType}' is not a valid SpiceDB name`);
			expect(type).toThrow(expect.objectContaining({ name: 'InvalidObjectTypeException', objectType }));
		});

		it('should reject a malformed name behind a valid legacy prefix', () => {
			expect(() => namespace.type('acme/Document')).toThrow(InvalidObjectTypeException);
		});

		it('should accept the longest object type name SpiceDB allows', () => {
			expect(namespace.type(LONGEST_NAME)).toBe(LONGEST_NAME);
		});

		it('should accept the longest object type name behind a legacy prefix', () => {
			expect(namespace.type(`acme/${LONGEST_NAME}`)).toBe(`acme/${LONGEST_NAME}`);
		});

		it('should accept the longest prefix segment SpiceDB allows', () => {
			expect(namespace.type(`${LONGEST_PREFIX_SEGMENT}/document`)).toBe(`${LONGEST_PREFIX_SEGMENT}/document`);
		});

		it('should reject a name one character too long behind a legacy prefix and name the name bound', () => {
			const objectType = `acme/${LONGEST_NAME}a`;
			const type = (): string => namespace.type(objectType);

			expect(type).toThrow(InvalidObjectTypeException);
			expect(type).toThrow(
				`Object type '${objectType}' is not a valid SpiceDB name; its name '${LONGEST_NAME}a' must be 3 to 64 characters`
			);
		});

		it.each([[`${LONGEST_PREFIX_SEGMENT}a/document`], [`acme/${LONGEST_PREFIX_SEGMENT}a/document`]])(
			'should reject %j because a prefix segment is one character too long, and name the prefix bound',
			(objectType) => {
				const type = (): string => namespace.type(objectType);

				expect(type).toThrow(InvalidObjectTypeException);
				expect(type).toThrow(
					`Object type '${objectType}' is not a valid SpiceDB name; its prefix '${LONGEST_PREFIX_SEGMENT}a' must be 3 to 63 characters`
				);
			}
		);
	});
});
