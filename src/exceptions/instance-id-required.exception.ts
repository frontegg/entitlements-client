import { InstanceResolutionException } from './instance-resolution.exception';

export class InstanceIdRequiredException extends InstanceResolutionException {
	constructor(public readonly configuredInstanceIds: string[]) {
		super('instanceId is required when more than one instance is configured and no defaultInstanceId is set');
	}
}
