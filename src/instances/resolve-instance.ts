import { InstanceRegistry } from './instance-registry';
import { ResolvedInstance } from './instance.types';
import { UnknownInstanceException } from '../exceptions/unknown-instance.exception';
import { InstanceIdRequiredException } from '../exceptions/instance-id-required.exception';

export function resolveInstance(registry: InstanceRegistry, instanceId?: string | null): ResolvedInstance {
	if (instanceId === undefined || instanceId === null) {
		if (registry.implicitInstance) {
			return registry.implicitInstance;
		}

		throw new InstanceIdRequiredException(registry.instanceIds);
	}

	const instance = registry.get(instanceId);
	if (!instance) {
		throw new UnknownInstanceException(instanceId, registry.instanceIds);
	}
	return instance;
}
