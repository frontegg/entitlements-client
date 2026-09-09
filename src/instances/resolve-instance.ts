import { InstanceRegistry, ResolvedInstance } from './instance-registry';
import { UnknownInstanceException } from '../exceptions/unknown-instance.exception';
import { InstanceIdRequiredException } from '../exceptions/instance-id-required.exception';

export function resolveInstance(registry: InstanceRegistry, instanceId?: string): ResolvedInstance {
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
		return registry.get(defaultInstanceId) as ResolvedInstance;
	}

	throw new InstanceIdRequiredException(registry.instanceIds);
}
