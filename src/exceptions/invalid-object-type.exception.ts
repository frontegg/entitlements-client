import { CallerInputException } from './caller-input.exception';

export class InvalidObjectTypeException extends CallerInputException {
	constructor(
		public readonly objectType: string,
		message = `Object type '${objectType}' must not contain '/'. Schema prefixes are applied by the SDK.`
	) {
		super(message);
		this.name = 'InvalidObjectTypeException';
	}
}
