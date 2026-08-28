import { ConfigurationInputIsInvalidException } from '../exceptions/configuration-input-is-invalid.exception';

export class SchemaScope {
	constructor(private readonly prefix: string) {}

	public get isLegacy(): boolean {
		return this.prefix === '';
	}

	public get schemaPrefix(): string {
		return this.prefix;
	}

	public type(objectType: string): string {
		if (objectType.includes('/')) {
			throw new ConfigurationInputIsInvalidException(
				`Object type '${objectType}' must not contain '/'. Schema prefixes are applied by the SDK.`
			);
		}

		return this.isLegacy ? objectType : `${this.prefix}/${objectType}`;
	}

	public strip(objectType: string): string {
		if (this.isLegacy) {
			return objectType;
		}

		const scopedPrefix = `${this.prefix}/`;
		return objectType.startsWith(scopedPrefix) ? objectType.slice(scopedPrefix.length) : objectType;
	}
}
