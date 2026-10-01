import { isDigit, isLower } from './character.utils';
import {
	SCHEMA_NAME_MAX_LENGTH,
	SCHEMA_NAME_MIN_LENGTH,
	SCHEMA_PREFIX_MAX_LENGTH,
	SCHEMA_PREFIX_MIN_LENGTH,
	VENDOR_SCHEMA_PREFIX_START
} from './instance.constants';

const isVendorIdCharacter = (char: string): boolean => isLower(char) || isDigit(char) || char === '-';

export function deriveSchemaPrefix(vendorId: string): string | undefined {
	if (![...vendorId].every(isVendorIdCharacter)) {
		return undefined;
	}

	const prefix = `${VENDOR_SCHEMA_PREFIX_START}${vendorId.split('-').join('_')}`;
	return isValidSchemaPrefix(prefix) ? prefix : undefined;
}

export function isValidSchemaPrefix(prefix: string): boolean {
	return isSchemaIdentifierWithin(prefix, SCHEMA_PREFIX_MIN_LENGTH, SCHEMA_PREFIX_MAX_LENGTH);
}

export function isValidSchemaName(name: string): boolean {
	return isSchemaIdentifierWithin(name, SCHEMA_NAME_MIN_LENGTH, SCHEMA_NAME_MAX_LENGTH);
}

function isSchemaIdentifierWithin(identifier: string, minLength: number, maxLength: number): boolean {
	if (identifier.length < minLength || identifier.length > maxLength) {
		return false;
	}

	if (!isLower(identifier[0])) {
		return false;
	}

	const last = identifier[identifier.length - 1];
	if (!isLower(last) && !isDigit(last)) {
		return false;
	}

	for (let index = 1; index < identifier.length - 1; index++) {
		const char = identifier[index];
		if (!isLower(char) && !isDigit(char) && char !== '_') {
			return false;
		}
	}

	return true;
}
