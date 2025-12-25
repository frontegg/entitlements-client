import { v1 } from '@authzed/authzed-node';
import { mock, MockProxy, mockReset } from 'jest-mock-extended';
import { EntitlementsSpiceDBQuery } from './entitlements-spicedb.query';
import { EntitlementsDynamicQuery, EntitlementsResult, RequestContextType, UserSubjectContext } from '../../types';
import { SpiceDBResponse } from '../../types/spicedb.dto';
import { encodeObjectId } from './base64.utils';

// Create a concrete test implementation to test the abstract class
class TestEntitlementsSpiceDBQuery extends EntitlementsSpiceDBQuery {
	constructor(client: v1.ZedPromiseClientInterface) {
		super(client);
	}

	async query(
		entitlementsQuery: EntitlementsDynamicQuery<RequestContextType>
	): Promise<SpiceDBResponse<EntitlementsResult>> {
		// Simple implementation for testing
		return { result: { result: true } };
	}

	// Expose protected methods for testing
	public testCreateCaveatContext(context: UserSubjectContext): v1.PbStruct {
		return this.createCaveatContext(context);
	}

	public testCreateBulkPermissionRequestItem(
		resourceObjectType: string,
		resourceObjectId: string,
		subjectObjectType: string,
		subjectObjectId: string,
		caveatContext: v1.PbStruct
	): v1.CheckBulkPermissionsRequestItem {
		return this.createBulkPermissionRequestItem(
			resourceObjectType,
			resourceObjectId,
			subjectObjectType,
			subjectObjectId,
			caveatContext
		);
	}

	public testCreateBulkPermissionsRequest(
		objectType: string,
		objectId: string,
		context: UserSubjectContext,
		caveatContext: v1.PbStruct
	): v1.CheckBulkPermissionsRequest {
		return this.createBulkPermissionsRequest(objectType, objectId, context, caveatContext);
	}

	public testProcessCheckBulkPermissionsResponse(res: v1.CheckBulkPermissionsResponse): boolean {
		return this.processCheckBulkPermissionsResponse(res);
	}

	public testExecuteCommonQuery(
		objectType: string,
		objectId: string,
		subjectContext: UserSubjectContext
	): Promise<SpiceDBResponse<EntitlementsResult>> {
		return this.executeCommonQuery(objectType, objectId, subjectContext);
	}
}

describe(EntitlementsSpiceDBQuery.name, () => {
	let queryClient: TestEntitlementsSpiceDBQuery;
	let mockClient: MockProxy<v1.ZedPromiseClientInterface>;
	let mockSpiceDBEndpoint: string;
	let mockSpiceDBToken: string;

	beforeAll(() => {
		mockClient = mock<v1.ZedPromiseClientInterface>();
		mockSpiceDBEndpoint = 'mock-endpoint';
		mockSpiceDBToken = 'mock-token';

		// Create a new instance of the test query class with the mock client
		queryClient = new TestEntitlementsSpiceDBQuery(mockClient);
	});

	beforeEach(() => {
		mockReset(mockClient);
	});

	describe('createCaveatContext', () => {
		it('should create caveat context with user attributes and current time', () => {
			const userContext: UserSubjectContext = {
				userId: 'user-123',
				tenantId: 'tenant-456',
				permissions: ['read', 'write'],
				attributes: {
					department: 'engineering',
					role: 'admin',
					level: 'senior'
				}
			};

			const caveatContext = queryClient.testCreateCaveatContext(userContext);

			expect(caveatContext.fields.user_context).toBeDefined();
			expect(caveatContext.fields.user_context.kind?.oneofKind).toBe('structValue');

			const structValue =
				caveatContext.fields.user_context.kind?.oneofKind === 'structValue'
					? caveatContext.fields.user_context.kind.structValue
					: undefined;
			expect(structValue?.fields.now).toBeDefined();
			expect(structValue?.fields.now.kind?.oneofKind).toBe('stringValue');
			if (structValue?.fields.now.kind?.oneofKind === 'stringValue') {
				expect(structValue.fields.now.kind.stringValue).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
			}

			expect(structValue?.fields.department).toBeDefined();
			expect(structValue?.fields.department.kind?.oneofKind).toBe('stringValue');
			if (structValue?.fields.department.kind?.oneofKind === 'stringValue') {
				expect(structValue.fields.department.kind.stringValue).toBe('engineering');
			}

			expect(structValue?.fields.role).toBeDefined();
			expect(structValue?.fields.role.kind?.oneofKind).toBe('stringValue');
			if (structValue?.fields.role.kind?.oneofKind === 'stringValue') {
				expect(structValue.fields.role.kind.stringValue).toBe('admin');
			}

			expect(structValue?.fields.level).toBeDefined();
			expect(structValue?.fields.level.kind?.oneofKind).toBe('stringValue');
			if (structValue?.fields.level.kind?.oneofKind === 'stringValue') {
				expect(structValue.fields.level.kind.stringValue).toBe('senior');
			}
		});

		it('should handle context with no attributes', () => {
			const userContext: UserSubjectContext = {
				userId: 'user-123',
				tenantId: 'tenant-456',
				permissions: ['read'],
				attributes: {}
			};

			const caveatContext = queryClient.testCreateCaveatContext(userContext);

			expect(caveatContext.fields.user_context).toBeDefined();
			const structValue =
				caveatContext.fields.user_context.kind?.oneofKind === 'structValue'
					? caveatContext.fields.user_context.kind.structValue
					: undefined;
			expect(structValue?.fields.now).toBeDefined();
			expect(Object.keys(structValue?.fields || {}).length).toBe(1); // Only 'now' field
		});

		it('should handle context with undefined attributes', () => {
			const userContext: UserSubjectContext = {
				userId: 'user-123',
				tenantId: 'tenant-456',
				permissions: ['read'],
				attributes: undefined
			};

			const caveatContext = queryClient.testCreateCaveatContext(userContext);

			expect(caveatContext.fields.user_context).toBeDefined();
			const structValue =
				caveatContext.fields.user_context.kind?.oneofKind === 'structValue'
					? caveatContext.fields.user_context.kind.structValue
					: undefined;
			expect(structValue?.fields.now).toBeDefined();
			expect(Object.keys(structValue?.fields || {}).length).toBe(1); // Only 'now' field
		});
	});

	describe('createBulkPermissionRequestItem', () => {
		it('should create bulk permission request item with correct structure', () => {
			const caveatContext = queryClient.testCreateCaveatContext({
				userId: 'user-123',
				tenantId: 'tenant-456',
				permissions: ['read'],
				attributes: {}
			});

			const requestItem = queryClient.testCreateBulkPermissionRequestItem(
				'frontegg_feature',
				'test-feature',
				'frontegg_user',
				'user-123',
				caveatContext
			);

			expect(requestItem.resource?.objectType).toBe('frontegg_feature');
			expect(requestItem.resource?.objectId).toBe(encodeObjectId('test-feature'));
			expect(requestItem.permission).toBe('access');
			expect(requestItem.subject?.object?.objectType).toBe('frontegg_user');
			expect(requestItem.subject?.object?.objectId).toBe(encodeObjectId('user-123'));
			expect(requestItem.subject?.optionalRelation).toBe('');
			expect(requestItem.context).toBe(caveatContext);
		});
	});

	describe('createBulkPermissionsRequest', () => {
		it('should create bulk permissions request with user and tenant items', () => {
			const userContext: UserSubjectContext = {
				userId: 'user-123',
				tenantId: 'tenant-456',
				permissions: ['read'],
				attributes: {}
			};

			const caveatContext = queryClient.testCreateCaveatContext(userContext);
			const bulkRequest = queryClient.testCreateBulkPermissionsRequest(
				'frontegg_feature',
				'test-feature',
				userContext,
				caveatContext
			);

			expect(bulkRequest.items).toHaveLength(2);

			// Check tenant item
			const tenantItem = bulkRequest.items.find((item) => item.subject?.object?.objectType === 'frontegg_tenant');
			expect(tenantItem).toBeDefined();
			expect(tenantItem?.subject?.object?.objectId).toBe(encodeObjectId('tenant-456'));

			// Check user item
			const userItem = bulkRequest.items.find((item) => item.subject?.object?.objectType === 'frontegg_user');
			expect(userItem).toBeDefined();
			expect(userItem?.subject?.object?.objectId).toBe(encodeObjectId('user-123'));
		});

		it('should create bulk permissions request with only tenant item when userId is undefined', () => {
			const userContext: UserSubjectContext = {
				userId: undefined,
				tenantId: 'tenant-456',
				permissions: ['read'],
				attributes: {}
			};

			const caveatContext = queryClient.testCreateCaveatContext(userContext);
			const bulkRequest = queryClient.testCreateBulkPermissionsRequest(
				'frontegg_feature',
				'test-feature',
				userContext,
				caveatContext
			);

			expect(bulkRequest.items).toHaveLength(1);

			// Check tenant item
			const tenantItem = bulkRequest.items[0];
			expect(tenantItem.subject?.object?.objectType).toBe('frontegg_tenant');
			expect(tenantItem.subject?.object?.objectId).toBe(encodeObjectId('tenant-456'));
		});
	});

	describe('processCheckBulkPermissionsResponse', () => {
		it('should return true when any pair has HAS_PERMISSION', () => {
			const response = v1.CheckBulkPermissionsResponse.create({
				pairs: [
					v1.CheckBulkPermissionsPair.create({
						request: v1.CheckBulkPermissionsRequestItem.create({}),
						response: {
							oneofKind: 'item',
							item: v1.CheckPermissionResponse.create({
								permissionship: v1.CheckPermissionResponse_Permissionship.NO_PERMISSION
							})
						}
					}),
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

			const result = queryClient.testProcessCheckBulkPermissionsResponse(response);
			expect(result).toBe(true);
		});

		it('should return false when no pairs have HAS_PERMISSION', () => {
			const response = v1.CheckBulkPermissionsResponse.create({
				pairs: [
					v1.CheckBulkPermissionsPair.create({
						request: v1.CheckBulkPermissionsRequestItem.create({}),
						response: {
							oneofKind: 'item',
							item: v1.CheckPermissionResponse.create({
								permissionship: v1.CheckPermissionResponse_Permissionship.NO_PERMISSION
							})
						}
					}),
					v1.CheckBulkPermissionsPair.create({
						request: v1.CheckBulkPermissionsRequestItem.create({}),
						response: {
							oneofKind: 'item',
							item: v1.CheckPermissionResponse.create({
								permissionship: v1.CheckPermissionResponse_Permissionship.CONDITIONAL_PERMISSION
							})
						}
					})
				]
			});

			const result = queryClient.testProcessCheckBulkPermissionsResponse(response);
			expect(result).toBe(false);
		});

		it('should return false when pairs array is empty', () => {
			const response = v1.CheckBulkPermissionsResponse.create({
				pairs: []
			});

			const result = queryClient.testProcessCheckBulkPermissionsResponse(response);
			expect(result).toBe(false);
		});
	});

	describe('executeCommonQuery', () => {
		it('should execute common query and return result', async () => {
			const userContext: UserSubjectContext = {
				userId: 'user-123',
				tenantId: 'tenant-456',
				permissions: ['read'],
				attributes: {}
			};

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

			const result = await queryClient.testExecuteCommonQuery('feature', 'test-feature', userContext);

			expect(mockClient.checkBulkPermissions).toHaveBeenCalled();
			expect(result.result.result).toBe(true);
		});

		it('should propagate errors from checkBulkPermissions', async () => {
			const userContext: UserSubjectContext = {
				userId: 'user-123',
				tenantId: 'tenant-456',
				permissions: ['read'],
				attributes: {}
			};

			const error = new Error('SpiceDB connection failed');
			mockClient.checkBulkPermissions.mockRejectedValue(error);

			await expect(queryClient.testExecuteCommonQuery('feature', 'test-feature', userContext)).rejects.toThrow(
				error
			);
		});
	});

	describe('encode/decode objectId', () => {
		it('should encode object ID to base64 URL-safe format', () => {
			const objectId = 'test-feature-123';
			const normalized = encodeObjectId(objectId);

			// Should be base64 encoded and URL-safe
			expect(normalized).not.toContain('+');
			expect(normalized).not.toContain('/');
			expect(normalized).not.toContain('=');

			// Should be reversible
			const decoded = Buffer.from(normalized.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
			expect(decoded).toBe(objectId);
		});

		it('should handle special characters', () => {
			const objectId = 'test+feature/with=special/chars';
			const normalized = encodeObjectId(objectId);

			// Should be URL-safe
			expect(normalized).not.toContain('+');
			expect(normalized).not.toContain('/');
			expect(normalized).not.toContain('=');
		});

		it('should handle empty string', () => {
			const objectId = '';
			const normalized = encodeObjectId(objectId);

			expect(normalized).toBe('');
		});

		it('should handle unicode characters', () => {
			const objectId = 'test-功能-123';
			const normalized = encodeObjectId(objectId);

			// Should be URL-safe
			expect(normalized).not.toContain('+');
			expect(normalized).not.toContain('/');
			expect(normalized).not.toContain('=');

			// Should be reversible
			const decoded = Buffer.from(normalized.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
			expect(decoded).toBe(objectId);
		});
	});
});
