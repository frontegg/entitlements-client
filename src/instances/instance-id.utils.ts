import { isDigit, isLower } from './character.utils';
import { INSTANCE_ID_MAX_LENGTH } from './instance.constants';

const isInstanceIdCharacter = (char: string): boolean => isLower(char) || isDigit(char) || char === '-' || char === '_';

export function isValidInstanceId(instanceId: string): boolean {
	if (instanceId.length === 0 || instanceId.length > INSTANCE_ID_MAX_LENGTH) {
		return false;
	}

	if (!isLower(instanceId[0]) && !isDigit(instanceId[0])) {
		return false;
	}

	return [...instanceId].every(isInstanceIdCharacter);
}
