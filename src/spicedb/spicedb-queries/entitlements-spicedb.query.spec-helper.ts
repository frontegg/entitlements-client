import { v1 } from '@authzed/authzed-node';
import { EntitlementsSpiceDBQuery } from './entitlements-spicedb.query';
import { mock, MockProxy, mockReset } from 'jest-mock-extended';
import {
	RequestContext,
	SubjectContext,
	RequestContextType,
	UserSubjectContext,
	EntitlementsDynamicQueryRequestContext
} from '../../types';

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
		default:
			throw new Error(`Unknown request context type: ${type}`);
	}
}

export function EntitlementsSpiceDBQueryCommonTests<R extends EntitlementsSpiceDBQuery, T extends RequestContextType>(
	ctor: new (client: v1.ZedPromiseClientInterface) => R,
	objectType: string,
	objectId: (requestContext: EntitlementsDynamicQueryRequestContext<T>) => string,
	contextProvider: () => {
		requestContext: EntitlementsDynamicQueryRequestContext<RequestContextType>;
		subjectContext?: SubjectContext;
	}
): void {
	describe(`[${ctor.name}] ${EntitlementsSpiceDBQuery.name} - common mocked tests`, () => {
		let queryClient: R;
		let mockClient: MockProxy<v1.ZedPromiseClientInterface>;
		let mockSpiceDBEndpoint: string;
		let mockSpiceDBToken: string;

		beforeAll(() => {
			mockClient = mock<v1.ZedPromiseClientInterface>();
			mockSpiceDBEndpoint = 'mock-endpoint';
			mockSpiceDBToken = 'mock-token';

			// Create a new instance of the query class with the mock client
			queryClient = new ctor(mockClient);
		});

		beforeEach(() => {
			mockReset(mockClient);
		});

		it('should call client.checkBulkPermissions with correct arguments', async () => {
			const defaultSubjectContext: UserSubjectContext = {
				userId: 'mock-user-id',
				tenantId: 'mock-tenant-id',
				permissions: ['mock-permission-key'],
				attributes: { mockAttribute: 'mock-value' }
			};
			const { requestContext, subjectContext } = contextProvider();
			const mockResponse = v1.CheckBulkPermissionsResponse.create({
				pairs: [
					v1.CheckBulkPermissionsPair.create({
						request: v1.CheckBulkPermissionsRequestItem.create({}),
						response: {
							oneofKind: 'item',
							item: v1.CheckPermissionResponse.create({
								permissionship: v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION
							})
						}
					})
				]
			});
			mockClient.checkBulkPermissions.mockResolvedValue(mockResponse);

			const result = await queryClient.query({
				subjectContext: subjectContext || defaultSubjectContext,
				requestContext
			});

			expect(mockClient.checkBulkPermissions).toHaveBeenCalled();
			expect(result.result.result).toBe(true);
		});

		it('should not block exceptions from client and propagate them to the user', async () => {
			const defaultSubjectContext: UserSubjectContext = {
				userId: 'mock-user-id',
				tenantId: 'mock-tenant-id',
				permissions: ['mock-permission-key'],
				attributes: { mockAttribute: 'mock-value' }
			};
			const { requestContext, subjectContext } = contextProvider();
			const mockError = new Error('mock-error');
			mockClient.checkBulkPermissions.mockRejectedValue(mockError);

			await expect(
				queryClient.query({
					subjectContext: subjectContext || defaultSubjectContext,
					requestContext
				})
			).rejects.toThrow(mockError);
		});
	});
}
