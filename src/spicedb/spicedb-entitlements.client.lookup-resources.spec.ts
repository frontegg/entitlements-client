import { SpiceDBEntitlementsClient } from './spicedb-entitlements.client';
import { mock, MockProxy } from 'jest-mock-extended';
import { LoggingClient } from '../logging';
import { ClientConfiguration } from '../client-configuration';
import { v1 } from '@authzed/authzed-node';
import { LookupResourcesRequest } from '../types';
import { encodeObjectId } from './spicedb-queries/base64.utils';

describe('SpiceDBEntitlementsClient.lookupResources', () => {
	let mockSpiceClient: MockProxy<v1.ZedPromiseClientInterface>;
	let mockLoggingClient: MockProxy<LoggingClient>;
	let client: SpiceDBEntitlementsClient;

	const mockClientConfig: ClientConfiguration = {
		spiceDBEndpoint: 'mock-endpoint',
		spiceDBToken: 'mock-token'
	};

	const defaultRequest: LookupResourcesRequest = {
		subjectType: 'user',
		subjectId: 'user-123',
		resourceType: 'document',
		permission: 'read'
	};

	beforeEach(() => {
		mockSpiceClient = mock<v1.ZedPromiseClientInterface>();
		mockLoggingClient = mock<LoggingClient>();
		client = new SpiceDBEntitlementsClient(mockClientConfig, mockLoggingClient, false);
		// Replace the internal spiceClient with our mock
		(client as any).spiceClient = mockSpiceClient;
	});

	describe('successful lookups', () => {
		it('should return resources with correct structure (decoded from base64)', async () => {
			// SpiceDB returns base64-encoded IDs
			const mockResults: v1.LookupResourcesResponse[] = [
				{
					lookedUpAt: undefined,
					resourceObjectId: encodeObjectId('resource-1'),
					permissionship: v1.LookupPermissionship.HAS_PERMISSION,
					partialCaveatInfo: undefined,
					afterResultCursor: undefined
				},
				{
					lookedUpAt: undefined,
					resourceObjectId: encodeObjectId('resource-2'),
					permissionship: v1.LookupPermissionship.CONDITIONAL_PERMISSION,
					partialCaveatInfo: undefined,
					afterResultCursor: undefined
				}
			];
			mockSpiceClient.lookupResources.mockResolvedValue(mockResults);

			const result = await client.lookupResources(defaultRequest);

			expect(result.resources).toHaveLength(2);
			// Response should contain decoded IDs
			expect(result.resources[0]).toEqual({
				resourceType: 'document',
				resourceId: 'resource-1',
				permissionship: 'HAS_PERMISSION'
			});
			expect(result.resources[1]).toEqual({
				resourceType: 'document',
				resourceId: 'resource-2',
				permissionship: 'CONDITIONAL_PERMISSION'
			});
			expect(result.totalReturned).toBe(2);
			expect(result.cursor).toBeUndefined();
		});

		it('should return empty resources array when no results', async () => {
			mockSpiceClient.lookupResources.mockResolvedValue([]);

			const result = await client.lookupResources(defaultRequest);

			expect(result.resources).toHaveLength(0);
			expect(result.totalReturned).toBe(0);
			expect(result.cursor).toBeUndefined();
		});

		it('should use default limit of 50 when not provided', async () => {
			mockSpiceClient.lookupResources.mockResolvedValue([]);

			await client.lookupResources(defaultRequest);

			expect(mockSpiceClient.lookupResources).toHaveBeenCalledWith(
				expect.objectContaining({
					optionalLimit: 50
				})
			);
		});

		it('should use provided limit', async () => {
			mockSpiceClient.lookupResources.mockResolvedValue([]);

			await client.lookupResources({ ...defaultRequest, limit: 100 });

			expect(mockSpiceClient.lookupResources).toHaveBeenCalledWith(
				expect.objectContaining({
					optionalLimit: 100
				})
			);
		});

		it('should build correct SpiceDB request with base64-encoded subjectId', async () => {
			mockSpiceClient.lookupResources.mockResolvedValue([]);

			await client.lookupResources(defaultRequest);

			expect(mockSpiceClient.lookupResources).toHaveBeenCalledWith(
				expect.objectContaining({
					resourceObjectType: 'document',
					permission: 'read',
					subject: expect.objectContaining({
						object: expect.objectContaining({
							objectType: 'user',
							objectId: encodeObjectId('user-123') // Request should encode the ID
						}),
						optionalRelation: ''
					})
				})
			);
		});
	});

	describe('pagination', () => {
		it('should return cursor when results equal limit and have afterResultCursor', async () => {
			// Create 50 mock results (the default limit) with a cursor
			const mockResults: v1.LookupResourcesResponse[] = Array.from({ length: 50 }, (_, i) => ({
				lookedUpAt: undefined,
				resourceObjectId: encodeObjectId(`resource-${i + 1}`),
				permissionship: v1.LookupPermissionship.HAS_PERMISSION,
				partialCaveatInfo: undefined,
				afterResultCursor: i === 49 ? { token: 'next-page-token' } : undefined
			}));
			mockSpiceClient.lookupResources.mockResolvedValue(mockResults);

			const result = await client.lookupResources(defaultRequest);

			expect(result.cursor).toBe('next-page-token'); // Returns cursor because results.length (50) === limit (50)
			expect(result.totalReturned).toBe(50);
		});

		it('should not return cursor when results are less than limit', async () => {
			const mockResults: v1.LookupResourcesResponse[] = [
				{
					lookedUpAt: undefined,
					resourceObjectId: encodeObjectId('resource-1'),
					permissionship: v1.LookupPermissionship.HAS_PERMISSION,
					partialCaveatInfo: undefined,
					afterResultCursor: { token: 'next-page-token' }
				}
			];
			mockSpiceClient.lookupResources.mockResolvedValue(mockResults);

			const result = await client.lookupResources(defaultRequest);

			expect(result.cursor).toBeUndefined(); // No cursor because results.length (1) < limit (50)
			expect(result.totalReturned).toBe(1);
		});

		it('should return no cursor when SpiceDB provides none', async () => {
			const mockResults: v1.LookupResourcesResponse[] = [
				{
					lookedUpAt: undefined,
					resourceObjectId: encodeObjectId('resource-1'),
					permissionship: v1.LookupPermissionship.HAS_PERMISSION,
					partialCaveatInfo: undefined,
					afterResultCursor: undefined // No cursor
				}
			];
			mockSpiceClient.lookupResources.mockResolvedValue(mockResults);

			const result = await client.lookupResources(defaultRequest);

			expect(result.cursor).toBeUndefined();
			expect(result.totalReturned).toBe(1);
		});

		it('should pass cursor to SpiceDB request when provided', async () => {
			mockSpiceClient.lookupResources.mockResolvedValue([]);

			await client.lookupResources({
				...defaultRequest,
				cursor: 'existing-cursor-token'
			});

			expect(mockSpiceClient.lookupResources).toHaveBeenCalledWith(
				expect.objectContaining({
					optionalCursor: expect.objectContaining({
						token: 'existing-cursor-token'
					})
				})
			);
		});

		it('should not pass cursor when not provided', async () => {
			mockSpiceClient.lookupResources.mockResolvedValue([]);

			await client.lookupResources(defaultRequest);

			const callArg = mockSpiceClient.lookupResources.mock.calls[0][0];
			expect(callArg.optionalCursor).toBeUndefined();
		});
	});

	describe('permissionship mapping', () => {
		it('should map HAS_PERMISSION correctly', async () => {
			const mockResults: v1.LookupResourcesResponse[] = [
				{
					lookedUpAt: undefined,
					resourceObjectId: encodeObjectId('resource-1'),
					permissionship: v1.LookupPermissionship.HAS_PERMISSION,
					partialCaveatInfo: undefined,
					afterResultCursor: undefined
				}
			];
			mockSpiceClient.lookupResources.mockResolvedValue(mockResults);

			const result = await client.lookupResources(defaultRequest);

			expect(result.resources[0].permissionship).toBe('HAS_PERMISSION');
		});

		it('should map CONDITIONAL_PERMISSION correctly', async () => {
			const mockResults: v1.LookupResourcesResponse[] = [
				{
					lookedUpAt: undefined,
					resourceObjectId: encodeObjectId('resource-1'),
					permissionship: v1.LookupPermissionship.CONDITIONAL_PERMISSION,
					partialCaveatInfo: undefined,
					afterResultCursor: undefined
				}
			];
			mockSpiceClient.lookupResources.mockResolvedValue(mockResults);

			const result = await client.lookupResources(defaultRequest);

			expect(result.resources[0].permissionship).toBe('CONDITIONAL_PERMISSION');
		});

		it('should map UNSPECIFIED to undefined', async () => {
			const mockResults: v1.LookupResourcesResponse[] = [
				{
					lookedUpAt: undefined,
					resourceObjectId: encodeObjectId('resource-1'),
					permissionship: v1.LookupPermissionship.UNSPECIFIED,
					partialCaveatInfo: undefined,
					afterResultCursor: undefined
				}
			];
			mockSpiceClient.lookupResources.mockResolvedValue(mockResults);

			const result = await client.lookupResources(defaultRequest);

			expect(result.resources[0].permissionship).toBeUndefined();
		});
	});

	describe('error handling', () => {
		it('should propagate SpiceDB errors', async () => {
			const spiceDBError = new Error('SpiceDB error');
			mockSpiceClient.lookupResources.mockRejectedValue(spiceDBError);

			await expect(client.lookupResources(defaultRequest)).rejects.toThrow('SpiceDB error');
		});
	});

	describe('result ordering', () => {
		it('should preserve the order of results from SpiceDB', async () => {
			const mockResults: v1.LookupResourcesResponse[] = [
				{
					lookedUpAt: undefined,
					resourceObjectId: encodeObjectId('first'),
					permissionship: v1.LookupPermissionship.HAS_PERMISSION,
					partialCaveatInfo: undefined,
					afterResultCursor: undefined
				},
				{
					lookedUpAt: undefined,
					resourceObjectId: encodeObjectId('second'),
					permissionship: v1.LookupPermissionship.HAS_PERMISSION,
					partialCaveatInfo: undefined,
					afterResultCursor: undefined
				},
				{
					lookedUpAt: undefined,
					resourceObjectId: encodeObjectId('third'),
					permissionship: v1.LookupPermissionship.HAS_PERMISSION,
					partialCaveatInfo: undefined,
					afterResultCursor: undefined
				}
			];
			mockSpiceClient.lookupResources.mockResolvedValue(mockResults);

			const result = await client.lookupResources(defaultRequest);

			expect(result.resources.map((r) => r.resourceId)).toEqual(['first', 'second', 'third']);
		});
	});
});
