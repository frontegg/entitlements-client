import { AxiosInstance } from 'axios';
import { EntitlementsOpaQuery } from './entitlements-opa-query';
import { mock, MockProxy, mockReset } from 'jest-mock-extended';
import { RequestContext, SubjectContext, RequestContextType } from '../types';

export function getRequestContext(type: RequestContextType): RequestContext {
	switch (type) {
		case RequestContextType.Feature:
			return {
				type: RequestContextType.Feature,
				featureKey: 'mock-feature'
			};
		case RequestContextType.Permission:
			return {
				type: RequestContextType.Permission,
				permissionKey: 'mock-permission-key'
			};
		case RequestContextType.Route:
			return {
				type: RequestContextType.Route,
				method: 'mock-method',
				path: 'mock-path'
			};
		case RequestContextType.Entity:
			return {
				type: RequestContextType.Entity,
				entityType: 'document',
				key: 'document-1',
				action: 'read'
			};
		case RequestContextType.Composite:
			return {
				type: RequestContextType.Composite,
				[RequestContextType.Feature]: {
					type: RequestContextType.Feature,
					featureKey: 'mock-feature'
				},
				[RequestContextType.Permission]: {
					type: RequestContextType.Permission,
					permissionKey: 'mock-permission-key'
				},
				[RequestContextType.Entity]: {
					type: RequestContextType.Entity,
					entityType: 'document',
					key: 'document-1',
					action: 'read'
				}
			};
		default:
			throw new Error(`Unknown request context type: ${type}`);
	}
}

export function EntitlementsOpaQueryCommonTests<R extends EntitlementsOpaQuery>(
	ctor: new (pdpHost: string, httpClient: AxiosInstance) => R,
	opaRoute: string,
	contextProvider: () => { requestContext: RequestContext; subjectContext?: SubjectContext }
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
			const defaultSubjectContext = {
				userId: 'mock-user-id',
				tenantId: 'mock-tenant-id',
				permissions: ['mock-permission'],
				attributes: { mockAttribute: 'mock-value' }
			};
			const { requestContext, subjectContext } = contextProvider();
			mockAxiosInstance.post.mockResolvedValue({ data: 'mock-data' });

			const result = await queryClient.query(subjectContext || defaultSubjectContext, requestContext);

			const expectedRequestContext: Partial<RequestContext> = { ...requestContext };
			delete expectedRequestContext.type;
			const expectedPayload = {
				input: {
					subjectContext: subjectContext || defaultSubjectContext,
					requestContext: expectedRequestContext
				}
			};
			expect(mockAxiosInstance.post).toHaveBeenCalledWith(opaRoute, expectedPayload, { baseURL: mockPdpHost });
			expect(result).toBe('mock-data');
		});

		it('should not block exceptions from httpClient and propagate them to the user', async () => {
			const defaultSubjectContext = {
				userId: 'mock-user-id',
				tenantId: 'mock-tenant-id',
				permissions: ['mock-permission'],
				attributes: { mockAttribute: 'mock-value' }
			};
			const { requestContext, subjectContext } = contextProvider();
			const mockError = new Error('mock-error');
			mockAxiosInstance.post.mockRejectedValue(mockError);

			await expect(queryClient.query(subjectContext || defaultSubjectContext, requestContext)).rejects.toThrow(
				mockError
			);
		});
	});
}
