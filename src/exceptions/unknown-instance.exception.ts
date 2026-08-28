import { InstanceResolutionException } from './instance-resolution.exception';

export class UnknownInstanceException extends InstanceResolutionException {
	constructor(
		public readonly instanceId: string,
		configuredInstanceIds: string[]
	) {
		super(
			`Unknown instanceId '${instanceId}'. Configured instances: ${
				configuredInstanceIds.length ? configuredInstanceIds.join(', ') : '<none>'
			}`
		);
	}
}
