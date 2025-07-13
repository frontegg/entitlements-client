import { v1 } from '@authzed/authzed-node';
import { mock, MockProxy, mockReset } from 'jest-mock-extended';
import { EntitlementsDynamicQueryRequestContext, RequestContextType, UserSubjectContext } from '../../types';
import { RouteSpiceDBQuery } from './route-spicedb.query';

describe(RouteSpiceDBQuery.name, () => {
	let queryClient: RouteSpiceDBQuery;
	let mockClient: MockProxy<v1.ZedPromiseClientInterface>;
	let mockSpiceDBEndpoint: string;
	let mockSpiceDBToken: string;

	beforeAll(() => {
		mockClient = mock<v1.ZedPromiseClientInterface>();
		mockSpiceDBEndpoint = 'mock-endpoint';
		mockSpiceDBToken = 'mock-token';

		// Create a new instance of the query class
		queryClient = new RouteSpiceDBQuery(mockSpiceDBEndpoint, mockSpiceDBToken);
		// Replace the client with our mock
		(queryClient as any).client = mockClient;
	});

	beforeEach(() => {
		mockReset(mockClient);
	});

	describe('query method', () => {
		const subjectContext: UserSubjectContext = {
			userId: 'user-123',
			tenantId: 'tenant-456',
			permissions: ['read', 'write'],
			attributes: { department: 'engineering' }
		};

		const requestContext: EntitlementsDynamicQueryRequestContext<RequestContextType.Route> = {
			type: RequestContextType.Route,
			method: 'GET',
			path: '/api/users'
		};

		it('should not block exceptions from client and propagate them to the user', async () => {
			const mockError = new Error('mock-error');

			// Mock the cache to return relations
			const mockRelations = [
				{
					relationship: {
						resource: {
							objectType: 'frontegg_route',
							objectId: 'route-1'
						},
						relation: 'access',
						optionalCaveat: {
							context: {
								fields: {
									pattern: {
										kind: {
											oneofKind: 'stringValue' as const,
											stringValue: 'GET /api/users'
										}
									}
								}
							}
						}
					}
				}
			];

			const mockCache = {
				wrap: jest.fn().mockResolvedValue(mockRelations)
			};
			(queryClient as any).cache = mockCache;

			mockClient.checkBulkPermissions.mockRejectedValue(mockError);

			await expect(
				queryClient.query({
					subjectContext,
					requestContext
				})
			).rejects.toThrow(mockError);
		});

		it('should handle empty relations array', async () => {
			// Mock the cache to return empty relations
			const mockCache = {
				wrap: jest.fn().mockResolvedValue([])
			};
			(queryClient as any).cache = mockCache;

			const mockBulkResponse = v1.CheckBulkPermissionsResponse.create({
				pairs: []
			});
			mockClient.checkBulkPermissions.mockResolvedValue(mockBulkResponse);

			const result = await queryClient.query({
				subjectContext,
				requestContext
			});

			expect(result.result.result).toBe(false);
		});

		it('should call checkBulkPermissions when relations are found', async () => {
			// Mock the cache to return relations
			const mockRelations = [
				{
					relationship: {
						resource: {
							objectType: 'frontegg_route',
							objectId: 'route-1'
						},
						relation: 'access',
						optionalCaveat: {
							context: {
								fields: {
									pattern: {
										kind: {
											oneofKind: 'stringValue' as const,
											stringValue: 'GET /api/users'
										}
									}
								}
							}
						}
					}
				}
			];

			const mockCache = {
				wrap: jest.fn().mockResolvedValue(mockRelations)
			};
			(queryClient as any).cache = mockCache;

			const mockBulkResponse = v1.CheckBulkPermissionsResponse.create({
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
			mockClient.checkBulkPermissions.mockResolvedValue(mockBulkResponse);

			const result = await queryClient.query({
				subjectContext,
				requestContext
			});

			expect(mockClient.checkBulkPermissions).toHaveBeenCalled();
			expect(result.result.result).toBe(true);
		});
	});
});
