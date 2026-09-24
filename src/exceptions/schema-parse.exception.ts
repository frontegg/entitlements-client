export class SchemaParseException extends Error {
	constructor(
		public readonly line: number,
		message: string
	) {
		super(`${message} at line ${line}`);
		this.name = 'SchemaParseException';
	}
}
