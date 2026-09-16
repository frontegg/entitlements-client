export const LEGACY_INSTANCE_ID = 'legacy';

export const INSTANCE_ID_MAX_LENGTH = 63;

export const INSTANCE_ID_RULE =
	`1 to ${INSTANCE_ID_MAX_LENGTH} characters containing only a-z, 0-9 and '-', ` + `and starting with a-z or 0-9`;

export const VENDOR_SCHEMA_PREFIX_START = 'v_';

export const TYPE_PATH_SEPARATOR = '/';

export const SPICEDB_OBJECT_TYPE = /^([a-z][a-z0-9_]{1,61}[a-z0-9]\/)*[a-z][a-z0-9_]{1,62}[a-z0-9]$/;

export const SCHEMA_PREFIX = /^[a-z][a-z0-9_]{1,61}[a-z0-9]$/;

export const INSTANCE_ID = /^[a-z0-9][a-z0-9-]{0,62}$/;

export const SPICEDB_NAMING_RULES_URL = 'https://authzed.com/docs/spicedb/concepts/schema#identifier-rules';

export const OBJECT_TYPE_RULE = `a valid SpiceDB object type; see ${SPICEDB_NAMING_RULES_URL}`;

export const SCHEMA_PREFIX_RULE = `a valid SpiceDB object type prefix; see ${SPICEDB_NAMING_RULES_URL}`;

export const VENDOR_ID_SCHEMA_PREFIX_RULE = `only a-z, 0-9 and '-', forming ${SCHEMA_PREFIX_RULE}`;
export const SCHEMA_HEADER_KEYWORDS = ['definition', 'caveat'];

export const SCHEMA_STRING_DELIMITERS = ['"""', "'''", '"', "'", '`'];
export const SCHEMA_RAW_STRING_PREFIXES = ['r', 'rb', 'br'];
