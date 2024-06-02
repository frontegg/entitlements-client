import { OpaQueryClient } from './opa-query.client';
import { mock, MockProxy, mockReset } from 'jest-mock-extended';
import { AxiosInstance } from 'axios';
import { RequestContext, RequestContextType, SubjectContext } from '../types';
import { FeaturesOpaRoute } from './features-opa-query';
import { PermissionsOpaRoute } from './permissions-opa-query';
import { RoutesOpaRoute } from './routes-opa-query';

describe(OpaQueryClient.name, () => {
	let queryClient: OpaQueryClient;
	let mockHttpClient: MockProxy<AxiosInstance>;
	let mockPdpHost: string;

	beforeAll(() => {
		mockHttpClient = mock<AxiosInstance>();
		mockPdpHost = 'mock-string';

		queryClient = new OpaQueryClient(mockPdpHost, mockHttpClient);
	});

	beforeEach(() => {
		mockReset(mockHttpClient);
	});

	it.each([
		{ requestContextType: RequestContextType.Feature, route: FeaturesOpaRoute },
		{ requestContextType: RequestContextType.Permission, route: PermissionsOpaRoute },
		{ requestContextType: RequestContextType.Route, route: RoutesOpaRoute }
	])('should call httpClient.post with correct arguments for %p', async ({ requestContextType, route }) => {
		const subjectContext: SubjectContext = {
			userId: 'mock-user-id',
			tenantId: 'mock-tenant-id',
			permissions: ['mock-permission'],
			attributes: { mockAttribute: 'mock-value' }
		};
		// Don't care about actual request context, just need to pass it to the query method
		const requestContext: RequestContext = {
			type: requestContextType,
			path: 'mock-path',
			method: 'mock-method',
			permissionKey: 'mock-permission-key',
			featureKey: 'mock-feature'
		};
		mockHttpClient.post.mockResolvedValue({ data: 'mock-data' });
		await queryClient.query(subjectContext, requestContext);
		expect(mockHttpClient.post).toHaveBeenCalledWith(route, expect.anything(), { baseURL: mockPdpHost });
	});
});
