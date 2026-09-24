export const LEGACY_INSTANCE_ID = 'legacy';

export const INSTANCE_ID_MAX_LENGTH = 63;

export const INSTANCE_ID_RULE =
	`1 to ${INSTANCE_ID_MAX_LENGTH} characters containing only a-z, 0-9, '-' and '_', ` +
	`and starting with a-z or 0-9`;

export const VENDOR_SCHEMA_PREFIX_START = 'v_';

export const TYPE_PATH_SEPARATOR = '/';

export const SCHEMA_NAME_MIN_LENGTH = 3;

export const SCHEMA_NAME_MAX_LENGTH = 63;

export const SCHEMA_NAME_RULE =
	`${SCHEMA_NAME_MIN_LENGTH} to ${SCHEMA_NAME_MAX_LENGTH} characters, starting with a-z, ` +
	`containing only a-z, 0-9 and '_', and ending with a-z or 0-9`;

export const VENDOR_ID_SCHEMA_PREFIX_RULE =
	`at most ${SCHEMA_NAME_MAX_LENGTH - VENDOR_SCHEMA_PREFIX_START.length} characters ` +
	`containing only a-z, 0-9 and '-', and not ending with '-'`;
