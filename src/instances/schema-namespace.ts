import { InvalidObjectTypeException } from '../exceptions/invalid-object-type.exception';

export class SchemaNamespace {
	private readonly typePrefix: string;

	constructor(
		private readonly prefix: string,
		public readonly instanceId: string
	) {
		this.typePrefix = prefix === '' ? '' : `${prefix}/`;
	}

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

		return `${this.typePrefix}${objectType}`;
	}
}
