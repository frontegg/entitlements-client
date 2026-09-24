import { isDigit, isLower } from './character.utils';
import { SCHEMA_NAME_MAX_LENGTH, SCHEMA_NAME_MIN_LENGTH, VENDOR_SCHEMA_PREFIX_START } from './instance.constants';

const isVendorIdCharacter = (char: string): boolean => isLower(char) || isDigit(char) || char === '-';

export function deriveSchemaPrefix(vendorId: string): string | undefined {
	if (![...vendorId].every(isVendorIdCharacter)) {
		return undefined;
	}

	const prefix = `${VENDOR_SCHEMA_PREFIX_START}${vendorId.split('-').join('_')}`;
	return isValidSchemaName(prefix) ? prefix : undefined;
}

export function isValidSchemaName(name: string): boolean {
	if (name.length < SCHEMA_NAME_MIN_LENGTH || name.length > SCHEMA_NAME_MAX_LENGTH) {
		return false;
	}

	if (!isLower(name[0])) {
		return false;
	}

	const last = name[name.length - 1];
	if (!isLower(last) && !isDigit(last)) {
		return false;
	}

	for (let index = 1; index < name.length - 1; index++) {
		const char = name[index];
		if (!isLower(char) && !isDigit(char) && char !== '_') {
			return false;
		}
	}

	return true;
}
