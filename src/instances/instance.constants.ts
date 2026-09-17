export const LEGACY_INSTANCE_ID = 'legacy';

export const INSTANCE_ID_MAX_LENGTH = 63;

export const INSTANCE_ID_RULE =
	`1 to ${INSTANCE_ID_MAX_LENGTH} characters containing only a-z, 0-9, '-' and '_', ` +
	`and starting with a-z or 0-9`;

export const VENDOR_SCHEMA_PREFIX_START = 'v_';

export const SCHEMA_PREFIX_MIN_LENGTH = 3;

export const SCHEMA_PREFIX_MAX_LENGTH = 63;

export const SCHEMA_PREFIX_RULE =
	`${SCHEMA_PREFIX_MIN_LENGTH} to ${SCHEMA_PREFIX_MAX_LENGTH} characters, starting with a-z, ` +
	`containing only a-z, 0-9 and '_', and ending with a-z or 0-9`;

export const VENDOR_ID_SCHEMA_PREFIX_RULE =
	`at most ${SCHEMA_PREFIX_MAX_LENGTH - VENDOR_SCHEMA_PREFIX_START.length} characters ` +
	`containing only a-z, 0-9 and '-', and not ending with '-'`;
export const FIELD_ACCESSOR = '.';

export const SCHEMA_HEADER_KEYWORDS = ['definition', 'caveat'];

export const SCHEMA_STRING_DELIMITERS = ['"""', "'''", '"', "'", '`'];
export const SCHEMA_RAW_STRING_PREFIXES = ['r', 'rb', 'br'];
