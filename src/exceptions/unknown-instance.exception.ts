import { InstanceResolutionException } from './instance-resolution.exception';

export class UnknownInstanceException extends InstanceResolutionException {
	constructor(
		public readonly instanceId: string,
		public readonly configuredInstanceIds: string[]
	) {
		super(
			configuredInstanceIds.length === 0
				? `Unknown instanceId '${instanceId}'; no instances are configured`
				: `Unknown instanceId '${instanceId}'; configured instances: ${configuredInstanceIds.join(', ')}`
		);
		this.name = 'UnknownInstanceException';
	}
}
