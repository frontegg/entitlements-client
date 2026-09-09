import { InvalidObjectTypeException } from '../exceptions/invalid-object-type.exception';

export class SchemaNamespace {
	constructor(
		private readonly prefix: string,
		public readonly instanceId: string = ''
	) {}

	public get isLegacy(): boolean {
		return this.prefix === '';
	}

	public get schemaPrefix(): string {
		return this.prefix;
	}

	public type(objectType: string): string {
		if (this.isLegacy) {
			return objectType;
		}

		if (objectType.includes('/')) {
			throw new InvalidObjectTypeException(
				objectType,
				`Object type '${objectType}' must not contain '/'. Schema prefixes are applied by the SDK.`
			);
		}

		return `${this.prefix}/${objectType}`;
	}

	public strip(objectType: string): string {
		if (this.isLegacy) {
			return objectType;
		}

		const namespacePrefix = `${this.prefix}/`;
		return objectType.startsWith(namespacePrefix) ? objectType.slice(namespacePrefix.length) : objectType;
	}
}
