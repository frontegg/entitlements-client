export class InvalidObjectTypeException extends Error {
	constructor(
		public readonly objectType: string,
		message: string
	) {
		super(message);
		this.name = 'InvalidObjectTypeException';
	}
}
