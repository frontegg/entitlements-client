import { ConfigurationInputIsInvalidException } from '../exceptions/configuration-input-is-invalid.exception';
import { InvalidObjectTypeException } from '../exceptions/invalid-object-type.exception';
import { SCHEMA_PREFIX_RULE, VENDOR_SCHEMA_PREFIX_START } from './instance.constants';
import { isValidSchemaPrefix } from './schema-prefix.utils';

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
		if (this.isLegacy) {
			if (objectType.startsWith(VENDOR_SCHEMA_PREFIX_START)) {
				throw new InvalidObjectTypeException(
					objectType,
					`Object type '${objectType}' must not start with the reserved vendor schema prefix '${VENDOR_SCHEMA_PREFIX_START}'.`
				);
			}

			return objectType;
		}

		if (objectType.includes('/')) {
			throw new InvalidObjectTypeException(objectType);
		}

		return `${this.schemaPrefix}/${objectType}`;
	}
}
