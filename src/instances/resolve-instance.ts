import { InstanceRegistry, ResolvedInstance } from './instance-registry';
import { UnknownInstanceException } from '../exceptions/unknown-instance.exception';
import { InstanceIdRequiredException } from '../exceptions/instance-id-required.exception';
import { LoggingClient } from '../logging';

export function resolveInstance(
	registry: InstanceRegistry,
	instanceId?: string,
	loggingClient?: LoggingClient
): ResolvedInstance {
	if (instanceId !== undefined) {
		const instance = registry.get(instanceId);
		if (!instance) {
			throw new UnknownInstanceException(instanceId, registry.instanceIds);
		}
		return instance;
	}

	if (registry.size === 1) {
		return registry.onlyInstance;
	}

	const { defaultInstanceId } = registry;
	if (defaultInstanceId !== undefined) {
		void loggingClient?.logRequest(
			{
				action: 'SpiceDB:resolveInstance:default',
				instanceId: defaultInstanceId,
				message: 'instanceId omitted; falling back to defaultInstanceId'
			},
			null
		);
		return registry.get(defaultInstanceId) as ResolvedInstance;
	}

	throw new InstanceIdRequiredException(registry.instanceIds);
}
