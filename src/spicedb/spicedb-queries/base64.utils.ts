export function encodeObjectId(objectId: string): string {
	return Buffer.from(objectId).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function decodeObjectId(encodedId: string): string {
	const base64 = encodedId.replace(/-/g, '+').replace(/_/g, '/');
	const paddedBase64 = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
	return Buffer.from(paddedBase64, 'base64').toString('utf-8');
}
