export class ConfigurationInputIsMissingException extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ConfigurationInputIsMissingException';
	}
}
