import {EntitlementsClientFactory} from './entitlements-client-factory';
import {ConfigurationInputIsMissingException} from './exceptions/configuration-input-is-missing.exception';
import {EntitlementsClient} from './entitlements.client';
import {AxiosInstance} from 'axios';
import {mock, MockProxy} from 'jest-mock-extended';
import {RequestContext, RequestContextType, SubjectContext} from './types';
import {ClientConfiguration} from './client-configuration';

describe(EntitlementsClientFactory.name, () => {
	it('should fail to create an EntitlementsClient when pdpHost is missing', () => {
		try {
			EntitlementsClientFactory.create({} as unknown as ClientConfiguration);
			fail();
		} catch (e) {
			expect(e).toBeInstanceOf(ConfigurationInputIsMissingException);
		}
	});

	it('should create an EntitlementsClient with default configuration', async () => {
		const client = EntitlementsClientFactory.create({pdpHost: 'mock-host'});
		expect(client).toBeInstanceOf(EntitlementsClient);
	});

	it.each(Object.values(RequestContextType))('should create an EntitlementsClient with custom axios instance for request context of type `%s`', async (requestContextType) => {
		const mockAxiosInstance: MockProxy<AxiosInstance> = mock<AxiosInstance>();
		mockAxiosInstance.post.mockResolvedValue({data: {result: {}}});
		const client = EntitlementsClientFactory.create({pdpHost: 'mock-host', axiosInstance: mockAxiosInstance});

		await client.isEntitledTo({} as unknown as SubjectContext, {type: requestContextType} as unknown as RequestContext);
		expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
	});
});
