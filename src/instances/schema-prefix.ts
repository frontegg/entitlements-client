const SPICEDB_PREFIX_PATTERN = /^[a-z_][a-z0-9_]{1,62}[a-z0-9]$/;

export function deriveSchemaPrefix(vendorId: string): string {
	return `v_${vendorId.toLowerCase().replace(/-/g, '_')}`;
}

export function isValidSchemaPrefix(prefix: string): boolean {
	return prefix === '' || SPICEDB_PREFIX_PATTERN.test(prefix);
}
