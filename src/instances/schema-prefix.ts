const MIN_LENGTH = 3;
const MAX_LENGTH = 63;

export const SCHEMA_PREFIX_RULE =
	`${MIN_LENGTH} to ${MAX_LENGTH} characters, starting with a-z, ` +
	`containing only a-z, 0-9 and '_', and ending with a-z or 0-9`;

const isLower = (char: string): boolean => char >= 'a' && char <= 'z';
const isDigit = (char: string): boolean => char >= '0' && char <= '9';

export function deriveSchemaPrefix(vendorId: string): string {
	return `v_${vendorId.toLowerCase().split('-').join('_')}`;
}

export function isValidSchemaPrefix(prefix: string): boolean {
	if (prefix.length < MIN_LENGTH || prefix.length > MAX_LENGTH) {
		return false;
	}

	if (!isLower(prefix[0] as string)) {
		return false;
	}

	const last = prefix[prefix.length - 1] as string;
	if (!isLower(last) && !isDigit(last)) {
		return false;
	}

	for (let index = 1; index < prefix.length - 1; index++) {
		const char = prefix[index] as string;
		if (!isLower(char) && !isDigit(char) && char !== '_') {
			return false;
		}
	}

	return true;
}
