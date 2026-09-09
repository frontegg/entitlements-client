const MIN_LENGTH = 3;
const MAX_LENGTH = 64;

const isLower = (char: string): boolean => char >= 'a' && char <= 'z';
const isDigit = (char: string): boolean => char >= '0' && char <= '9';

export function deriveSchemaPrefix(vendorId: string): string {
	return `v_${vendorId.toLowerCase().split('-').join('_')}`;
}

export function isValidSchemaPrefix(prefix: string): boolean {
	if (prefix === '') {
		return true;
	}

	if (prefix.length < MIN_LENGTH || prefix.length > MAX_LENGTH) {
		return false;
	}

	const first = prefix[0] as string;
	if (!isLower(first)) {
		return false;
	}

	const last = prefix[prefix.length - 1] as string;
	if (!isLower(last) && !isDigit(last)) {
		return false;
	}

	return [...prefix].every((char) => isLower(char) || isDigit(char) || char === '_');
}
