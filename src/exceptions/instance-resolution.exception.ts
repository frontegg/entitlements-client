export abstract class InstanceResolutionException extends Error {
	protected constructor(message: string) {
		super(message);
		this.name = new.target.name;
	}
}
