import { AxiosInstance } from 'axios';
import { EntitlementsOpaQuery } from './entitlements-opa-query';
import { mock, MockProxy, mockReset } from 'jest-mock-extended';
import { RequestContext } from '../types';

export function EntitlementsOpaQueryCommonTests<R extends EntitlementsOpaQuery>(
	ctor: new (pdpHost: string, httpClient: AxiosInstance) => R,
	opaRoute: string,
	contextProvider: () => RequestContext
): void {
	describe(`[${ctor.name}] ${EntitlementsOpaQuery.name} - common mocked tests`, () => {
		let queryClient: R;
		let mockAxiosInstance: MockProxy<AxiosInstance>;
		let mockPdpHost: string;

		beforeAll(() => {
			mockAxiosInstance = mock<AxiosInstance>();
			mockPdpHost = 'mock-string';

			queryClient = new ctor(mockPdpHost, mockAxiosInstance);
		});

		beforeEach(() => {
			mockReset(mockAxiosInstance);
		});

		it('should call httpClient.post with correct arguments', async () => {
			const subjectContext = {
				userId: 'mock-user-id',
				tenantId: 'mock-tenant-id',
				permissions: ['mock-permission'],
				attributes: { mockAttribute: 'mock-value' }
			};
			const requestContext: RequestContext = contextProvider();
			mockAxiosInstance.post.mockResolvedValue({ data: 'mock-data' });

			const result = await queryClient.query(subjectContext, requestContext);

			const expectedRequestContext: Partial<RequestContext> = { ...requestContext };

			const expectedPayload = {
				input: {
					subjectContext,
					requestContext: expectedRequestContext
				}
			};
			expect(mockAxiosInstance.post).toHaveBeenCalledWith(opaRoute, expectedPayload, { baseURL: mockPdpHost });
			expect(result).toBe('mock-data');
		});

		it('should not block exceptions from httpClient and propagate them to the user', async () => {
			const subjectContext = {
				userId: 'mock-user-id',
				tenantId: 'mock-tenant-id',
				permissions: ['mock-permission'],
				attributes: { mockAttribute: 'mock-value' }
			};
			const requestContext: RequestContext = contextProvider();
			const mockError = new Error('mock-error');
			mockAxiosInstance.post.mockRejectedValue(mockError);

			await expect(queryClient.query(subjectContext, requestContext)).rejects.toThrow(mockError);
		});
	});
}
