import { InstanceResolutionException } from './instance-resolution.exception';

export class UnknownInstanceException extends InstanceResolutionException {
	constructor(
		public readonly instanceId: string,
		public readonly configuredInstanceIds: string[]
	) {
		super(`Unknown instanceId '${instanceId}'`);
	}
}
