import { EntitlementsClientFactory } from './entitlements-client-factory';
import { ConfigurationInputIsMissingException } from './exceptions/configuration-input-is-missing.exception';
import { RequestContext, RequestContextType, SubjectContext } from './types';
import { ClientConfiguration } from './client-configuration';
import { SpiceDBEntitlementsClient } from './spicedb/spicedb-entitlements.client';

describe(EntitlementsClientFactory.name, () => {
	it('should fail to create an EntitlementsClient when engineEndpoint is missing', () => {
		try {
			EntitlementsClientFactory.create({} as unknown as ClientConfiguration);
			fail();
		} catch (e) {
			expect(e).toBeInstanceOf(ConfigurationInputIsMissingException);
		}
	});

	it('should fail to create an EntitlementsClient when engineToken is missing', () => {
		try {
			EntitlementsClientFactory.create({ engineEndpoint: 'mock-host' } as ClientConfiguration);
			fail();
		} catch (e) {
			expect(e).toBeInstanceOf(ConfigurationInputIsMissingException);
		}
	});
	it('should create an EntitlementsClient with default configuration', async () => {
		const client = EntitlementsClientFactory.create({
			engineEndpoint: 'mock-host',
			engineToken: 'mock-token'
		});
		expect(client).toBeInstanceOf(SpiceDBEntitlementsClient);
	});

	it.each(Object.values(RequestContextType))(
		'should create an EntitlementsClient and call isEntitledTo for request context of type `%s`',
		async (requestContextType) => {
			const client = EntitlementsClientFactory.create({
				engineEndpoint: 'mock-host',
				engineToken: 'mock-token'
			});

			// Mock the spiceDBQuery method to avoid actual API calls
			jest.spyOn(client['spiceDBQueryClient'], 'spiceDBQuery').mockResolvedValue({
				result: { result: true }
			});

			const result = await client.isEntitledTo(
				{} as unknown as SubjectContext,
				{ type: requestContextType } as unknown as RequestContext
			);

			expect(result).toEqual({ result: true });
			expect(client['spiceDBQueryClient'].spiceDBQuery).toHaveBeenCalledTimes(1);
		}
	);
});
