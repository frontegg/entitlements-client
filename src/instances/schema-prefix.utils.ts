import { SCHEMA_PREFIX_MAX_LENGTH, SCHEMA_PREFIX_MIN_LENGTH } from './instance.constants';

const isLower = (char: string): boolean => char >= 'a' && char <= 'z';
const isDigit = (char: string): boolean => char >= '0' && char <= '9';

export function deriveSchemaPrefix(vendorId: string): string {
	return `v_${vendorId.toLowerCase().split('-').join('_')}`;
}

export function isValidSchemaPrefix(prefix: string): boolean {
	if (prefix.length < SCHEMA_PREFIX_MIN_LENGTH || prefix.length > SCHEMA_PREFIX_MAX_LENGTH) {
		return false;
	}

	if (!isLower(prefix[0])) {
		return false;
	}

	const last = prefix[prefix.length - 1];
	if (!isLower(last) && !isDigit(last)) {
		return false;
	}

	for (let index = 1; index < prefix.length - 1; index++) {
		const char = prefix[index];
		if (!isLower(char) && !isDigit(char) && char !== '_') {
			return false;
		}
	}

	return true;
}
