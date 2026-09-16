export class InvalidObjectTypeException extends Error {
	constructor(public readonly objectType: string) {
		super(`Object type '${objectType}' must not contain '/'. Schema prefixes are applied by the SDK.`);
		this.name = 'InvalidObjectTypeException';
	}
}
