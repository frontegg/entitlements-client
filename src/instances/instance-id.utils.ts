import { INSTANCE_ID } from './instance.constants';

export function isValidInstanceId(instanceId: string): boolean {
	return INSTANCE_ID.test(instanceId);
}
