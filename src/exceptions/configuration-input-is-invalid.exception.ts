export class ConfigurationInputIsInvalidException extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ConfigurationInputIsInvalidException';
	}
}
