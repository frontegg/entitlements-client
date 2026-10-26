import { v1 } from '@authzed/authzed-node';
import { SpiceDBEntitlementsClient } from './spicedb-entitlements.client';
import { SpiceDBQueryClient } from './spicedb-queries/spicedb-query.client';

export function setSpiceDBQueryClient(client: SpiceDBEntitlementsClient, spiceDBQueryClient: SpiceDBQueryClient): void {
	Object.defineProperty(client, 'spiceDBQueryClient', { value: spiceDBQueryClient });
}

export function setSpiceClient(client: SpiceDBEntitlementsClient, spiceClient: v1.ZedPromiseClientInterface): void {
	Object.defineProperty(client, 'spiceClient', { value: spiceClient });
}
