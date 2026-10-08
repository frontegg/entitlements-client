import { SCHEMA_PREFIX, VENDOR_SCHEMA_PREFIX_START } from './instance.constants';

export function deriveSchemaPrefix(vendorId: string): string | undefined {
	if (vendorId.includes('_')) {
		return undefined;
	}

	const prefix = `${VENDOR_SCHEMA_PREFIX_START}${vendorId.split('-').join('_')}`;
	return SCHEMA_PREFIX.test(prefix) ? prefix : undefined;
}
