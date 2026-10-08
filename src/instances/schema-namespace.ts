import { ConfigurationInputIsInvalidException } from '../exceptions/configuration-input-is-invalid.exception';
import { InvalidObjectTypeException } from '../exceptions/invalid-object-type.exception';
import {
	OBJECT_TYPE_RULE,
	SCHEMA_PREFIX,
	SCHEMA_PREFIX_RULE,
	SPICEDB_OBJECT_TYPE,
	TYPE_PATH_SEPARATOR,
	VENDOR_SCHEMA_PREFIX_START
} from './instance.constants';

function assertValidObjectType(objectType: string): void {
	if (!SPICEDB_OBJECT_TYPE.test(objectType)) {
		throw new InvalidObjectTypeException(objectType, `Object type '${objectType}' is not ${OBJECT_TYPE_RULE}`);
	}
}

export class SchemaNamespace {
	private constructor(
		public readonly schemaPrefix: string,
		public readonly instanceId: string
	) {}

	public static prefixed(schemaPrefix: string, instanceId: string): SchemaNamespace {
		if (!SCHEMA_PREFIX.test(schemaPrefix)) {
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
		const isTypePath = objectType.includes(TYPE_PATH_SEPARATOR);

		if (this.isLegacy) {
			if (isTypePath && objectType.startsWith(VENDOR_SCHEMA_PREFIX_START)) {
				throw new InvalidObjectTypeException(
					objectType,
					`Object type '${objectType}' must not start with the reserved vendor schema prefix '${VENDOR_SCHEMA_PREFIX_START}'.`
				);
			}

			assertValidObjectType(objectType);

			return objectType;
		}

		if (isTypePath) {
			throw new InvalidObjectTypeException(objectType);
		}

		assertValidObjectType(objectType);

		return `${this.schemaPrefix}${TYPE_PATH_SEPARATOR}${objectType}`;
	}
}
