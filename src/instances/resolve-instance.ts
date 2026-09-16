import { InstanceRegistry, ResolvedInstance } from './instance-registry';
import { UnknownInstanceException } from '../exceptions/unknown-instance.exception';
import { InstanceIdRequiredException } from '../exceptions/instance-id-required.exception';

export function resolveInstance(registry: InstanceRegistry, instanceId?: string | null): ResolvedInstance {
	if (instanceId) {
		const instance = registry.get(instanceId);
		if (!instance) {
			throw new UnknownInstanceException(instanceId, registry.instanceIds);
		}
		return instance;
	}

	if (registry.implicitInstance) {
		return registry.implicitInstance;
	}

	throw new InstanceIdRequiredException(registry.instanceIds);
}
