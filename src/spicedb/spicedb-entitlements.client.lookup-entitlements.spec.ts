import { v1 } from '@authzed/authzed-node';
import { mock, MockProxy } from 'jest-mock-extended';
import { ClientConfiguration } from '../client-configuration';
import { LoggingClient } from '../logging';
import { LookupEntitlementsRequest, RequestContextType } from '../types';
import { encodeObjectId } from './spicedb-queries/base64.utils';
import { SpiceDBEntitlementsClient } from './spicedb-entitlements.client';

function readCaveatNow(request: v1.LookupResourcesRequest): string | undefined {
	const userContext = request.context?.fields?.user_context?.kind;
	if (userContext?.oneofKind !== 'structValue') {
		return undefined;
	}
	const nowField = userContext.structValue.fields.now?.kind;
	if (nowField?.oneofKind !== 'stringValue') {
		return undefined;
	}
	return nowField.stringValue;
}

describe('SpiceDBEntitlementsClient.lookupEntitlements', () => {
	let mockSpiceClient: MockProxy<v1.ZedPromiseClientInterface>;
	let mockLoggingClient: MockProxy<LoggingClient>;
	let client: SpiceDBEntitlementsClient;

	const mockClientConfig: ClientConfiguration = {
		engineEndpoint: 'mock-endpoint',
		engineToken: 'mock-token'
	};

	const fixedNow = '2026-05-31T00:00:00.000Z';

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
		jest.useFakeTimers({ now: new Date(fixedNow) });
		mockSpiceClient = mock<v1.ZedPromiseClientInterface>();
		mockLoggingClient = mock<LoggingClient>();
		client = new SpiceDBEntitlementsClient(mockClientConfig, mockLoggingClient, false);
		Object.defineProperty(client, 'spiceClient', { value: mockSpiceClient });
	});

	afterEach(() => {
		jest.useRealTimers();
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
			cursor: encodeObjectId(JSON.stringify({ tenant: { token: 'tenant-next-cursor' }, user: {}, now: fixedNow }))
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

		const inputCursor = encodeObjectId(JSON.stringify({ tenant: { token: 'existing-cursor' } }));

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
		const expectedCursor = encodeObjectId(JSON.stringify({ tenant: { token: 'next-cursor' }, now: fixedNow }));
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

	it('should clear the cursor when both subject streams are exhausted on a subsequent page', async () => {
		mockSpiceClient.checkPermission.mockResolvedValue(
			v1.CheckPermissionResponse.create({
				permissionship: v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION
			})
		);
		mockSpiceClient.lookupResources.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

		const inputCursor = encodeObjectId(
			JSON.stringify({ tenant: { token: 'tenant-cursor' }, user: { token: 'user-cursor' } })
		);

		const result = await client.lookupEntitlements({
			...defaultRequest,
			subject: {
				...defaultRequest.subject,
				userId: 'user-1'
			},
			limit: 50,
			cursor: inputCursor
		});

		expect(result.entitlements).toEqual([]);
		expect(result.cursor).toBeUndefined();
	});

	it('should clear a stream cursor when it returns fewer results than the limit', async () => {
		mockSpiceClient.lookupResources.mockResolvedValue([
			{
				lookedUpAt: undefined,
				resourceObjectId: encodeObjectId('feature-a'),
				permissionship: v1.LookupPermissionship.HAS_PERMISSION,
				partialCaveatInfo: undefined,
				afterResultCursor: { token: 'dangling-cursor' }
			}
		]);

		const inputCursor = encodeObjectId(JSON.stringify({ tenant: { token: 'tenant-cursor' } }));

		const result = await client.lookupEntitlements({
			...defaultRequest,
			limit: 50,
			cursor: inputCursor
		});

		expect(result.cursor).toBeUndefined();
	});

	it('should terminate pagination across tenant and user streams without re-querying exhausted streams', async () => {
		mockSpiceClient.checkPermission.mockResolvedValue(
			v1.CheckPermissionResponse.create({
				permissionship: v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION
			})
		);
		mockSpiceClient.lookupResources.mockImplementation(async (request) => {
			const objectType = request.subject?.object?.objectType;
			const token = request.optionalCursor?.token;
			if (objectType === 'frontegg_tenant') {
				return token
					? []
					: [
							{
								lookedUpAt: undefined,
								resourceObjectId: encodeObjectId('basic'),
								permissionship: v1.LookupPermissionship.HAS_PERMISSION,
								partialCaveatInfo: undefined,
								afterResultCursor: { token: 'tenant-page-2' }
							}
					  ];
			}
			return token
				? []
				: [
						{
							lookedUpAt: undefined,
							resourceObjectId: encodeObjectId('premium'),
							permissionship: v1.LookupPermissionship.HAS_PERMISSION,
							partialCaveatInfo: undefined,
							afterResultCursor: { token: 'user-page-2' }
						}
				  ];
		});

		const collectedKeys: string[] = [];
		let cursor: string | undefined;
		let pages = 0;
		do {
			const response = await client.lookupEntitlements({
				...defaultRequest,
				subject: {
					...defaultRequest.subject,
					userId: 'user-1'
				},
				limit: 1,
				cursor
			});
			collectedKeys.push(...response.entitlements.map((entitlement) => entitlement.key));
			cursor = response.cursor;
			pages += 1;
			expect(pages).toBeLessThanOrEqual(10);
		} while (cursor);

		expect([...collectedKeys].sort()).toEqual(['basic', 'premium']);
	});

	it('should pin the now caveat context across pages so SpiceDB cursor arguments stay identical', async () => {
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

		jest.setSystemTime(new Date('2026-05-31T01:00:00.000Z'));

		mockSpiceClient.lookupResources.mockResolvedValueOnce([
			{
				lookedUpAt: undefined,
				resourceObjectId: encodeObjectId('feature-b'),
				permissionship: v1.LookupPermissionship.HAS_PERMISSION,
				partialCaveatInfo: undefined,
				afterResultCursor: undefined
			}
		]);

		await client.lookupEntitlements({ ...defaultRequest, limit: 1, cursor: page1.cursor });

		const page1Now = readCaveatNow(mockSpiceClient.lookupResources.mock.calls[0][0]);
		const page2Now = readCaveatNow(mockSpiceClient.lookupResources.mock.calls[1][0]);
		expect(page1Now).toBe(fixedNow);
		expect(page2Now).toBe(fixedNow);
	});

	it('should log and propagate SpiceDB errors', async () => {
		const spiceDBError = new Error('SpiceDB error');
		mockSpiceClient.lookupResources.mockRejectedValue(spiceDBError);

		await expect(client.lookupEntitlements(defaultRequest)).rejects.toThrow('SpiceDB error');

		expect(mockLoggingClient.error).toHaveBeenCalledWith(spiceDBError);
	});
});
