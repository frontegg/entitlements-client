import { v1 } from '@authzed/authzed-node';
import { mock, MockProxy } from 'jest-mock-extended';
import { ClientConfiguration } from '../client-configuration';
import { LoggingClient } from '../logging';
import { LookupEntitlementsRequest, RequestContextType } from '../types';
import { encodeObjectId } from './spicedb-queries/base64.utils';
import { SpiceDBEntitlementsClient } from './spicedb-entitlements.client';

describe('SpiceDBEntitlementsClient.lookupEntitlements', () => {
	let mockSpiceClient: MockProxy<v1.ZedPromiseClientInterface>;
	let mockLoggingClient: MockProxy<LoggingClient>;
	let client: SpiceDBEntitlementsClient;

	const mockClientConfig: ClientConfiguration = {
		engineEndpoint: 'mock-endpoint',
		engineToken: 'mock-token'
	};

	const defaultRequest: LookupEntitlementsRequest = {
		subject: {
			tenantId: 'tenant-1',
			attributes: {
				plan: 'pro'
			}
		},
		criteria: {
			type: RequestContextType.Feature
		}
	};

	beforeEach(() => {
		mockSpiceClient = mock<v1.ZedPromiseClientInterface>();
		mockLoggingClient = mock<LoggingClient>();
		client = new SpiceDBEntitlementsClient(mockClientConfig, mockLoggingClient, false);
		Object.defineProperty(client, 'spiceClient', { value: mockSpiceClient });
	});

	it('should lookup feature entitlements for a tenant subject', async () => {
		mockSpiceClient.lookupResources.mockResolvedValue([
			{
				lookedUpAt: undefined,
				resourceObjectId: encodeObjectId('feature-a'),
				permissionship: v1.LookupPermissionship.HAS_PERMISSION,
				partialCaveatInfo: undefined,
				afterResultCursor: undefined
			},
			{
				lookedUpAt: undefined,
				resourceObjectId: encodeObjectId('feature-b'),
				permissionship: v1.LookupPermissionship.CONDITIONAL_PERMISSION,
				partialCaveatInfo: undefined,
				afterResultCursor: undefined
			}
		]);

		const result = await client.lookupEntitlements(defaultRequest);

		expect(mockSpiceClient.lookupResources).toHaveBeenCalledTimes(1);
		expect(mockSpiceClient.lookupResources).toHaveBeenCalledWith(
			expect.objectContaining({
				resourceObjectType: 'frontegg_feature',
				permission: 'access',
				subject: expect.objectContaining({
					object: expect.objectContaining({
						objectType: 'frontegg_tenant',
						objectId: encodeObjectId('tenant-1')
					}),
					optionalRelation: ''
				}),
				optionalLimit: 50
			})
		);
		expect(result).toEqual({
			entitlements: [
				{ type: RequestContextType.Feature, key: 'feature-a', permissionship: 'HAS_PERMISSION' },
				{ type: RequestContextType.Feature, key: 'feature-b', permissionship: 'CONDITIONAL_PERMISSION' }
			],
			totalReturned: 2,
			cursor: undefined
		});
	});

	it('should lookup tenant and user feature entitlements for a user subject and deduplicate results', async () => {
		mockSpiceClient.checkPermission.mockResolvedValue(
			v1.CheckPermissionResponse.create({
				permissionship: v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION
			})
		);
		mockSpiceClient.lookupResources
			.mockResolvedValueOnce([
				{
					lookedUpAt: undefined,
					resourceObjectId: encodeObjectId('tenant-feature'),
					permissionship: v1.LookupPermissionship.HAS_PERMISSION,
					partialCaveatInfo: undefined,
					afterResultCursor: undefined
				},
				{
					lookedUpAt: undefined,
					resourceObjectId: encodeObjectId('shared-feature'),
					permissionship: v1.LookupPermissionship.HAS_PERMISSION,
					partialCaveatInfo: undefined,
					afterResultCursor: undefined
				}
			])
			.mockResolvedValueOnce([
				{
					lookedUpAt: undefined,
					resourceObjectId: encodeObjectId('user-feature'),
					permissionship: v1.LookupPermissionship.HAS_PERMISSION,
					partialCaveatInfo: undefined,
					afterResultCursor: undefined
				},
				{
					lookedUpAt: undefined,
					resourceObjectId: encodeObjectId('shared-feature'),
					permissionship: v1.LookupPermissionship.HAS_PERMISSION,
					partialCaveatInfo: undefined,
					afterResultCursor: undefined
				}
			]);

		const result = await client.lookupEntitlements({
			...defaultRequest,
			subject: {
				...defaultRequest.subject,
				userId: 'user-1'
			}
		});

		expect(mockSpiceClient.lookupResources).toHaveBeenCalledTimes(2);
		expect(mockSpiceClient.lookupResources).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				subject: expect.objectContaining({
					object: expect.objectContaining({
						objectType: 'frontegg_tenant',
						objectId: encodeObjectId('tenant-1')
					})
				})
			})
		);
		expect(mockSpiceClient.lookupResources).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				subject: expect.objectContaining({
					object: expect.objectContaining({
						objectType: 'frontegg_user',
						objectId: encodeObjectId('user-1')
					})
				})
			})
		);
		expect(result.entitlements).toEqual([
			{ type: RequestContextType.Feature, key: 'tenant-feature', permissionship: 'HAS_PERMISSION' },
			{ type: RequestContextType.Feature, key: 'shared-feature', permissionship: 'HAS_PERMISSION' },
			{ type: RequestContextType.Feature, key: 'user-feature', permissionship: 'HAS_PERMISSION' }
		]);
		expect(result.totalReturned).toBe(3);
	});

	it('should not return more entitlements than the requested limit for a user subject', async () => {
		mockSpiceClient.checkPermission.mockResolvedValue(
			v1.CheckPermissionResponse.create({
				permissionship: v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION
			})
		);
		mockSpiceClient.lookupResources
			.mockResolvedValueOnce([
				{
					lookedUpAt: undefined,
					resourceObjectId: encodeObjectId('tenant-feature-a'),
					permissionship: v1.LookupPermissionship.HAS_PERMISSION,
					partialCaveatInfo: undefined,
					afterResultCursor: undefined
				},
				{
					lookedUpAt: undefined,
					resourceObjectId: encodeObjectId('tenant-feature-b'),
					permissionship: v1.LookupPermissionship.HAS_PERMISSION,
					partialCaveatInfo: undefined,
					afterResultCursor: { token: 'tenant-next-cursor' }
				}
			])
			.mockResolvedValueOnce([
				{
					lookedUpAt: undefined,
					resourceObjectId: encodeObjectId('user-feature-a'),
					permissionship: v1.LookupPermissionship.HAS_PERMISSION,
					partialCaveatInfo: undefined,
					afterResultCursor: undefined
				},
				{
					lookedUpAt: undefined,
					resourceObjectId: encodeObjectId('user-feature-b'),
					permissionship: v1.LookupPermissionship.HAS_PERMISSION,
					partialCaveatInfo: undefined,
					afterResultCursor: { token: 'user-next-cursor' }
				}
			]);

		const result = await client.lookupEntitlements({
			...defaultRequest,
			subject: {
				...defaultRequest.subject,
				userId: 'user-1'
			},
			limit: 2
		});

		expect(result).toEqual({
			entitlements: [
				{ type: RequestContextType.Feature, key: 'tenant-feature-a', permissionship: 'HAS_PERMISSION' },
				{ type: RequestContextType.Feature, key: 'tenant-feature-b', permissionship: 'HAS_PERMISSION' }
			],
			totalReturned: 2,
			cursor: encodeObjectId(JSON.stringify({ tenant: 'tenant-next-cursor', user: undefined }))
		});
	});

	it('should return empty entitlements when the user is not a tenant member', async () => {
		mockSpiceClient.checkPermission.mockResolvedValue(
			v1.CheckPermissionResponse.create({
				permissionship: v1.CheckPermissionResponse_Permissionship.NO_PERMISSION
			})
		);
		mockSpiceClient.lookupResources.mockResolvedValue([
			{
				lookedUpAt: undefined,
				resourceObjectId: encodeObjectId('feature-a'),
				permissionship: v1.LookupPermissionship.HAS_PERMISSION,
				partialCaveatInfo: undefined,
				afterResultCursor: undefined
			}
		]);

		const result = await client.lookupEntitlements({
			...defaultRequest,
			subject: {
				...defaultRequest.subject,
				userId: 'Unknown'
			}
		});

		expect(mockSpiceClient.checkPermission).toHaveBeenCalledWith(
			expect.objectContaining({
				resource: expect.objectContaining({
					objectType: 'frontegg_tenant',
					objectId: encodeObjectId('tenant-1')
				}),
				permission: 'access',
				subject: expect.objectContaining({
					object: expect.objectContaining({
						objectType: 'frontegg_user',
						objectId: encodeObjectId('Unknown')
					})
				})
			})
		);
		expect(mockSpiceClient.lookupResources).not.toHaveBeenCalled();
		expect(result).toEqual({
			entitlements: [],
			totalReturned: 0,
			cursor: undefined
		});
	});

	it('should pass pagination options to SpiceDB and return the next cursor as an encoded composite token', async () => {
		mockSpiceClient.lookupResources.mockResolvedValue([
			{
				lookedUpAt: undefined,
				resourceObjectId: encodeObjectId('feature-a'),
				permissionship: v1.LookupPermissionship.HAS_PERMISSION,
				partialCaveatInfo: undefined,
				afterResultCursor: undefined
			},
			{
				lookedUpAt: undefined,
				resourceObjectId: encodeObjectId('feature-b'),
				permissionship: v1.LookupPermissionship.HAS_PERMISSION,
				partialCaveatInfo: undefined,
				afterResultCursor: { token: 'next-cursor' }
			}
		]);

		const inputCursor = encodeObjectId(JSON.stringify({ tenant: 'existing-cursor' }));

		const result = await client.lookupEntitlements({
			...defaultRequest,
			limit: 2,
			cursor: inputCursor
		});

		expect(mockSpiceClient.lookupResources).toHaveBeenCalledWith(
			expect.objectContaining({
				optionalLimit: 2,
				optionalCursor: expect.objectContaining({
					token: 'existing-cursor'
				})
			})
		);
		const expectedCursor = encodeObjectId(JSON.stringify({ tenant: 'next-cursor', user: undefined }));
		expect(result.cursor).toBe(expectedCursor);
	});

	it('should correctly round-trip tenant-only pagination cursors across pages', async () => {
		mockSpiceClient.lookupResources.mockResolvedValueOnce([
			{
				lookedUpAt: undefined,
				resourceObjectId: encodeObjectId('feature-a'),
				permissionship: v1.LookupPermissionship.HAS_PERMISSION,
				partialCaveatInfo: undefined,
				afterResultCursor: { token: 'spicedb-page2-token' }
			}
		]);

		const page1 = await client.lookupEntitlements({ ...defaultRequest, limit: 1 });

		expect(page1.cursor).toBeDefined();

		mockSpiceClient.lookupResources.mockResolvedValueOnce([
			{
				lookedUpAt: undefined,
				resourceObjectId: encodeObjectId('feature-b'),
				permissionship: v1.LookupPermissionship.HAS_PERMISSION,
				partialCaveatInfo: undefined,
				afterResultCursor: undefined
			}
		]);

		const page2 = await client.lookupEntitlements({ ...defaultRequest, limit: 1, cursor: page1.cursor });

		expect(mockSpiceClient.lookupResources).toHaveBeenLastCalledWith(
			expect.objectContaining({
				optionalCursor: expect.objectContaining({ token: 'spicedb-page2-token' })
			})
		);
		expect(page2.cursor).toBeUndefined();
	});

	it('should log and propagate SpiceDB errors', async () => {
		const spiceDBError = new Error('SpiceDB error');
		mockSpiceClient.lookupResources.mockRejectedValue(spiceDBError);

		await expect(client.lookupEntitlements(defaultRequest)).rejects.toThrow('SpiceDB error');

		expect(mockLoggingClient.error).toHaveBeenCalledWith(spiceDBError);
	});
});
