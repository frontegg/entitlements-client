import { ConfigurationInputIsInvalidException } from '../exceptions/configuration-input-is-invalid.exception';
import { InvalidObjectTypeException } from '../exceptions/invalid-object-type.exception';
import {
	SCHEMA_NAME_RULE,
	SCHEMA_PREFIX_RULE,
	TYPE_PATH_SEPARATOR,
	VENDOR_SCHEMA_PREFIX_START
} from './instance.constants';
import { isValidSchemaName, isValidSchemaPrefix } from './schema-prefix.utils';

function assertValidObjectType(objectType: string, segments: string[]): void {
	const prefixes = segments.slice(0, -1);
	const name = segments[segments.length - 1];
	const invalidPrefix = prefixes.find((prefix) => !isValidSchemaPrefix(prefix));

	if (invalidPrefix !== undefined) {
		throw new InvalidObjectTypeException(
			objectType,
			`Object type '${objectType}' is not a valid SpiceDB name; its prefix '${invalidPrefix}' must be ${SCHEMA_PREFIX_RULE}`
		);
	}

	if (!isValidSchemaName(name)) {
		const expectation = prefixes.length === 0 ? 'expected' : `its name '${name}' must be`;

		throw new InvalidObjectTypeException(
			objectType,
			`Object type '${objectType}' is not a valid SpiceDB name; ${expectation} ${SCHEMA_NAME_RULE}`
		);
	}
}

export class SchemaNamespace {
	private constructor(
		public readonly schemaPrefix: string,
		public readonly instanceId: string
	) {}

	public static prefixed(schemaPrefix: string, instanceId: string): SchemaNamespace {
		if (!isValidSchemaPrefix(schemaPrefix)) {
			throw new ConfigurationInputIsInvalidException(
				`Invalid schema prefix '${schemaPrefix}' for instance '${instanceId}'; expected ${SCHEMA_PREFIX_RULE}`
			);
		}

		return new SchemaNamespace(schemaPrefix, instanceId);
	}

	public static legacy(instanceId: string): SchemaNamespace {
		return new SchemaNamespace('', instanceId);
	}

	public get isLegacy(): boolean {
		return this.schemaPrefix === '';
	}

	public type(objectType: string): string {
		const segments = objectType.split(TYPE_PATH_SEPARATOR);

		if (this.isLegacy) {
			if (segments.length > 1 && segments[0].startsWith(VENDOR_SCHEMA_PREFIX_START)) {
				throw new InvalidObjectTypeException(
					objectType,
					`Object type '${objectType}' must not start with the reserved vendor schema prefix '${VENDOR_SCHEMA_PREFIX_START}'.`
				);
			}

			assertValidObjectType(objectType, segments);

			return objectType;
		}

		if (segments.length > 1) {
			throw new InvalidObjectTypeException(objectType);
		}

		assertValidObjectType(objectType, segments);

		return `${this.schemaPrefix}${TYPE_PATH_SEPARATOR}${objectType}`;
	}
}
