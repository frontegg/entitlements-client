import { v1 } from '@authzed/authzed-node';
import { SpiceDBEntitlementsClient } from './spicedb-entitlements.client';
import { mock, MockProxy } from 'jest-mock-extended';
import { SpiceDBQueryClient } from './spicedb-queries/spicedb-query.client';
import { LoggingClient } from '../logging';
import { PermissionsEntitlementsContext, RequestContext, RequestContextType, UserSubjectContext } from '../types';
import { ClientConfiguration } from '../client-configuration';
import { UnknownInstanceException } from '../exceptions/unknown-instance.exception';
import { InstanceIdRequiredException } from '../exceptions/instance-id-required.exception';
import { InvalidObjectTypeException } from '../exceptions/invalid-object-type.exception';
import { setSpiceClient, setSpiceDBQueryClient } from './spicedb-entitlements.client.spec-helper';
import { UNEXPECTED_ITEM_FAILURE_MESSAGE } from './entitlements.constants';
import { ConfigurationInputIsInvalidException } from '../exceptions/configuration-input-is-invalid.exception';

const VENDOR_A = '2f9c1a44-7b0e-4a1e-9f8a-1c2d3e4f5a6b';
const VENDOR_B = '8b1d0e77-3c5a-4f2b-9d6e-7a8b9c0d1e2f';
const PREFIX_A = 'v_2f9c1a44_7b0e_4a1e_9f8a_1c2d3e4f5a6b';
const PREFIX_B = 'v_8b1d0e77_3c5a_4f2b_9d6e_7a8b9c0d1e2f';

const subjectContext: UserSubjectContext = {
	tenantId: 'mock-tenant-id',
	userId: 'mock-user-id',
	permissions: ['mock-permission'],
	attributes: {}
};

const featureContext: RequestContext = { type: RequestContextType.Feature, featureKey: 'premium' };

const BATCH_SIZE = 20;

const FAILING_ITEM_INDEX = 6;

const permissionKeyOf = (index: number): string => (index === FAILING_ITEM_INDEX ? 'boom' : `permission_${index}`);

const permissionBatch = (): RequestContext[] =>
	Array.from({ length: BATCH_SIZE }, (unused, index) => ({
		type: RequestContextType.Permission,
		permissionKey: permissionKeyOf(index)
	}));

const isFailingItem = (requestContext: RequestContext): boolean =>
	(requestContext as PermissionsEntitlementsContext).permissionKey === 'boom';

const TWO_INSTANCES: ClientConfiguration['instances'] = [
	{ instanceId: 'a', vendorId: VENDOR_A },
	{ instanceId: 'b', vendorId: VENDOR_B }
];

function buildClient(
	configuration: Partial<ClientConfiguration>,
	queryClient: SpiceDBQueryClient,
	loggingClient: LoggingClient
): SpiceDBEntitlementsClient {
	const full: ClientConfiguration = {
		engineEndpoint: 'localhost:50051',
		engineToken: 'token',
		...configuration
	};
	const client = new SpiceDBEntitlementsClient(full, loggingClient, false, full.fallbackConfiguration);
	setSpiceDBQueryClient(client, queryClient);
	return client;
}

function grantingSpiceClient(): MockProxy<v1.ZedPromiseClientInterface> {
	const spiceClient = mock<v1.ZedPromiseClientInterface>();
	spiceClient.checkPermission.mockResolvedValue(
		v1.CheckPermissionResponse.create({
			permissionship: v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION
		})
	);
	return spiceClient;
}

describe('SpiceDBEntitlementsClient instance isolation', () => {
	let queryClient: MockProxy<SpiceDBQueryClient>;
	let loggingClient: MockProxy<LoggingClient>;

	beforeEach(() => {
		queryClient = mock<SpiceDBQueryClient>();
		loggingClient = mock<LoggingClient>();
		queryClient.spiceDBQuery.mockResolvedValue({ result: { result: true } });
	});

	describe('namespace routing', () => {
		it('should pass the resolved instance namespace to the query client', async () => {
			const client = buildClient({ instances: TWO_INSTANCES }, queryClient, loggingClient);

			await client.isEntitledTo(subjectContext, featureContext, { instanceId: 'b' });

			const namespace = queryClient.spiceDBQuery.mock.calls[0][2];
			expect(namespace.schemaPrefix).toBe(PREFIX_B);
			expect(namespace.type('frontegg_feature')).toBe(`${PREFIX_B}/frontegg_feature`);
		});

		it('should route each instanceId to its own prefix', async () => {
			const client = buildClient({ instances: TWO_INSTANCES }, queryClient, loggingClient);

			await client.isEntitledTo(subjectContext, featureContext, { instanceId: 'a' });
			await client.isEntitledTo(subjectContext, featureContext, { instanceId: 'b' });

			expect(queryClient.spiceDBQuery.mock.calls[0][2].schemaPrefix).toBe(PREFIX_A);
			expect(queryClient.spiceDBQuery.mock.calls[1][2].schemaPrefix).toBe(PREFIX_B);
		});

		it('should use a legacy namespace when no instances are configured', async () => {
			const client = buildClient({}, queryClient, loggingClient);

			await client.isEntitledTo(subjectContext, featureContext);

			expect(queryClient.spiceDBQuery.mock.calls[0][2].isLegacy).toBe(true);
		});
	});

	describe('fail closed', () => {
		it('should throw for an unconfigured instanceId and make no SpiceDB call', async () => {
			const client = buildClient({ instances: TWO_INSTANCES }, queryClient, loggingClient);

			await expect(
				client.isEntitledTo(subjectContext, featureContext, { instanceId: 'nope' })
			).rejects.toBeInstanceOf(UnknownInstanceException);
			expect(queryClient.spiceDBQuery).not.toHaveBeenCalled();
		});

		it('should throw when instanceId is omitted with several instances configured', async () => {
			const client = buildClient({ instances: TWO_INSTANCES }, queryClient, loggingClient);

			await expect(client.isEntitledTo(subjectContext, featureContext)).rejects.toBeInstanceOf(
				InstanceIdRequiredException
			);
			expect(queryClient.spiceDBQuery).not.toHaveBeenCalled();
		});

		it('should not swallow a resolution failure into the fallback boolean', async () => {
			const client = buildClient(
				{ instances: TWO_INSTANCES, fallbackConfiguration: { defaultFallback: true } },
				queryClient,
				loggingClient
			);

			await expect(client.isEntitledTo(subjectContext, featureContext)).rejects.toBeInstanceOf(
				InstanceIdRequiredException
			);
		});

		it('should throw from isEntitledToMany as well', async () => {
			const client = buildClient({ instances: TWO_INSTANCES }, queryClient, loggingClient);

			await expect(client.isEntitledToMany(subjectContext, [featureContext])).rejects.toBeInstanceOf(
				InstanceIdRequiredException
			);
		});

		it('should not swallow a prefix escape into the fallback boolean', async () => {
			const spiceClient = grantingSpiceClient();
			const client = buildClient(
				{ instances: TWO_INSTANCES, fallbackConfiguration: { defaultFallback: true } },
				new SpiceDBQueryClient(spiceClient),
				loggingClient
			);

			const check = client.isEntitledTo(
				{ entityType: 'cust_user', key: 'u1' },
				{
					type: RequestContextType.Entity,
					entityType: 'v_other/cust_document',
					key: 'doc-1',
					action: 'access'
				},
				{ instanceId: 'a' }
			);

			await expect(check).rejects.toBeInstanceOf(InvalidObjectTypeException);
			await expect(check).rejects.toThrow("must not contain '/'");
			expect(spiceClient.checkPermission).not.toHaveBeenCalled();
		});

		it('should log the prefix escape exactly once with the instanceId before rethrowing it', async () => {
			const client = buildClient(
				{ instances: TWO_INSTANCES, fallbackConfiguration: { defaultFallback: true } },
				new SpiceDBQueryClient(grantingSpiceClient()),
				loggingClient
			);

			await expect(
				client.isEntitledTo(
					{ entityType: 'cust_user', key: 'u1' },
					{
						type: RequestContextType.Entity,
						entityType: 'v_other/cust_document',
						key: 'doc-1',
						action: 'access'
					},
					{ instanceId: 'a' }
				)
			).rejects.toBeInstanceOf(InvalidObjectTypeException);
			expect(loggingClient.error).toHaveBeenCalledTimes(1);
			expect(loggingClient.error).toHaveBeenCalledWith(expect.any(InvalidObjectTypeException), {
				instanceId: 'a'
			});
		});

		it('should fail only the prefix escape item, log it and still answer the others', async () => {
			const spiceClient = grantingSpiceClient();
			const client = buildClient(
				{ instances: TWO_INSTANCES, fallbackConfiguration: { defaultFallback: true } },
				new SpiceDBQueryClient(spiceClient),
				loggingClient
			);

			const results = await client.isEntitledToMany(
				{ entityType: 'cust_user', key: 'u1' },
				[
					{ type: RequestContextType.Entity, entityType: 'doc', key: 'good', action: 'read' },
					{ type: RequestContextType.Entity, entityType: 'v_other/doc', key: 'bad', action: 'read' },
					{ type: RequestContextType.Entity, entityType: 'doc', key: 'also-good', action: 'read' }
				],
				{ instanceId: 'a' }
			);

			expect(results).toEqual([
				{ result: true },
				{ result: false, error: expect.stringContaining("must not contain '/'") },
				{ result: true }
			]);
			expect(spiceClient.checkPermission).toHaveBeenCalledTimes(2);
			expect(loggingClient.error).toHaveBeenCalledTimes(1);
			expect(loggingClient.error).toHaveBeenCalledWith(expect.any(InvalidObjectTypeException), {
				instanceId: 'a'
			});
		});

		it('should still return the fallback for a genuine SpiceDB error and log it with the instanceId', async () => {
			const error = new Error('spicedb unavailable');
			queryClient.spiceDBQuery.mockRejectedValue(error);
			const client = buildClient(
				{ instances: TWO_INSTANCES, fallbackConfiguration: { defaultFallback: true } },
				queryClient,
				loggingClient
			);

			await expect(client.isEntitledTo(subjectContext, featureContext, { instanceId: 'a' })).resolves.toEqual({
				result: true
			});
			expect(loggingClient.error).toHaveBeenCalledWith(error, { instanceId: 'a' });
		});
	});

	describe('legacy compatibility', () => {
		it('should let a legacy caller keep using a namespaced entityType', async () => {
			const spiceClient = grantingSpiceClient();
			const client = buildClient({}, new SpiceDBQueryClient(spiceClient), loggingClient);

			await expect(
				client.isEntitledTo(
					{ entityType: 'acme/user', key: 'u1' },
					{ type: RequestContextType.Entity, entityType: 'acme/document', key: 'd1', action: 'access' }
				)
			).resolves.toEqual({ result: true });

			const request = spiceClient.checkPermission.mock.calls[0][0];
			expect(request.resource?.objectType).toBe('acme/document');
			expect(request.subject?.object?.objectType).toBe('acme/user');
		});

		it('should reject a legacy caller addressing a vendor namespace instead of answering with the fallback', async () => {
			const spiceClient = grantingSpiceClient();
			const client = buildClient(
				{ fallbackConfiguration: { defaultFallback: true } },
				new SpiceDBQueryClient(spiceClient),
				loggingClient
			);

			await expect(
				client.isEntitledTo(
					{ entityType: 'acme/user', key: 'u1' },
					{ type: RequestContextType.Entity, entityType: 'v_other/document', key: 'd1', action: 'access' }
				)
			).rejects.toThrow(
				"Object type 'v_other/document' must not start with the reserved vendor schema prefix 'v_'."
			);
			expect(spiceClient.checkPermission).not.toHaveBeenCalled();
			expect(loggingClient.error).toHaveBeenCalledWith(expect.any(InvalidObjectTypeException), {
				instanceId: 'legacy'
			});
		});
	});

	describe('defaultInstanceId', () => {
		it('should use the default when instanceId is omitted', async () => {
			const client = buildClient(
				{ instances: TWO_INSTANCES, defaultInstanceId: 'a' },
				queryClient,
				loggingClient
			);

			await client.isEntitledTo(subjectContext, featureContext);

			expect(queryClient.spiceDBQuery.mock.calls[0][2].schemaPrefix).toBe(PREFIX_A);
		});
	});

	describe('lookup instance routing', () => {
		let spiceClient: MockProxy<v1.ZedPromiseClientInterface>;

		beforeEach(() => {
			spiceClient = mock<v1.ZedPromiseClientInterface>();
			spiceClient.lookupResources.mockResolvedValue([]);
			spiceClient.lookupSubjects.mockResolvedValue([]);
		});

		it('should namespace lookupTargetEntities by the options instanceId', async () => {
			const client = buildClient({ instances: TWO_INSTANCES }, queryClient, loggingClient);
			setSpiceClient(client, spiceClient);

			await client.lookupTargetEntities(
				{ entityType: 'cust_user', entityId: 'u1', TargetEntityType: 'cust_document', action: 'access' },
				{ instanceId: 'b' }
			);

			expect(spiceClient.lookupResources.mock.calls[0][0].resourceObjectType).toBe(`${PREFIX_B}/cust_document`);
		});

		it('should namespace lookupEntities by the options instanceId', async () => {
			const client = buildClient({ instances: TWO_INSTANCES }, queryClient, loggingClient);
			setSpiceClient(client, spiceClient);

			await client.lookupEntities(
				{
					TargetEntityType: 'cust_document',
					TargetEntityId: 'd1',
					entityType: 'cust_user',
					action: 'access'
				},
				{ instanceId: 'a' }
			);

			expect(spiceClient.lookupSubjects.mock.calls[0][0].subjectObjectType).toBe(`${PREFIX_A}/cust_user`);
		});

		it('should throw and make no call when the lookup instanceId is unknown', async () => {
			const client = buildClient({ instances: TWO_INSTANCES }, queryClient, loggingClient);
			setSpiceClient(client, spiceClient);

			await expect(
				client.lookupTargetEntities(
					{ entityType: 'cust_user', entityId: 'u1', TargetEntityType: 'cust_document', action: 'access' },
					{ instanceId: 'nope' }
				)
			).rejects.toBeInstanceOf(UnknownInstanceException);
			expect(spiceClient.lookupResources).not.toHaveBeenCalled();
		});

		it('should log a lookup failure with the instanceId', async () => {
			const error = new Error('spicedb unavailable');
			spiceClient.lookupSubjects.mockRejectedValue(error);
			const client = buildClient({ instances: TWO_INSTANCES }, queryClient, loggingClient);
			setSpiceClient(client, spiceClient);

			await expect(
				client.lookupEntities(
					{
						TargetEntityType: 'cust_document',
						TargetEntityId: 'd1',
						entityType: 'cust_user',
						action: 'access'
					},
					{ instanceId: 'b' }
				)
			).rejects.toThrow('spicedb unavailable');
			expect(loggingClient.error).toHaveBeenCalledWith(error, { instanceId: 'b' });
		});
	});

	describe('readSchemaFor', () => {
		it('should return only the requested instance schema with its prefix stripped', async () => {
			const spiceClient = mock<v1.ZedPromiseClientInterface>();
			spiceClient.readSchema.mockResolvedValue(
				v1.ReadSchemaResponse.create({
					schemaText: [
						`definition ${PREFIX_A}/frontegg_feature {}`,
						`definition ${PREFIX_B}/frontegg_feature {}`,
						`caveat ${PREFIX_B}/targeting(plan string) {`,
						'\tplan == "pro"',
						'}'
					].join('\n')
				})
			);
			const client = buildClient({ instances: TWO_INSTANCES }, queryClient, loggingClient);
			setSpiceClient(client, spiceClient);

			await expect(client.readSchemaFor({ instanceId: 'b' })).resolves.toBe(
				['definition frontegg_feature {}', '', 'caveat targeting(plan string) {', '\tplan == "pro"', '}'].join(
					'\n'
				)
			);
		});
	});

	describe('legacy readSchemaFor', () => {
		it('should return only the unprefixed blocks of a shared schema, never another vendor blocks', async () => {
			const spiceClient = mock<v1.ZedPromiseClientInterface>();
			spiceClient.readSchema.mockResolvedValue(
				v1.ReadSchemaResponse.create({
					schemaText: [
						'definition frontegg_feature {}',
						`definition ${PREFIX_A}/frontegg_feature {}`,
						`caveat ${PREFIX_B}/targeting(plan string) {`,
						'\tplan == "pro"',
						'}',
						'caveat targeting(plan string) {',
						'\tplan == "free"',
						'}'
					].join('\n')
				})
			);
			const client = buildClient({}, queryClient, loggingClient);
			setSpiceClient(client, spiceClient);

			await expect(client.readSchemaFor()).resolves.toBe(
				['definition frontegg_feature {}', '', 'caveat targeting(plan string) {', '\tplan == "free"', '}'].join(
					'\n'
				)
			);
		});
	});

	describe('batch isolation', () => {
		it('should fail only the item whose unexpected error escaped and still answer the others', async () => {
			queryClient.spiceDBQuery.mockImplementation(async (subjectContext, requestContext) => {
				if (isFailingItem(requestContext)) {
					throw new Error('spicedb unavailable');
				}
				return { result: { result: true } };
			});
			const client = buildClient(
				{
					instances: TWO_INSTANCES,
					fallbackConfiguration: (requestContext): boolean => {
						if (isFailingItem(requestContext)) {
							throw new Error('fallback exploded');
						}
						return false;
					}
				},
				queryClient,
				loggingClient
			);

			const results = await client.isEntitledToMany(subjectContext, permissionBatch(), { instanceId: 'a' });

			expect(results).toHaveLength(BATCH_SIZE);
			expect(results[FAILING_ITEM_INDEX]).toEqual({
				result: false,
				error: UNEXPECTED_ITEM_FAILURE_MESSAGE
			});
			expect(results.filter((result) => result.result === true)).toHaveLength(BATCH_SIZE - 1);
		});

		it('should log the unexpected item error once with the instanceId', async () => {
			const fallbackError = new Error('fallback exploded');
			queryClient.spiceDBQuery.mockImplementation(async (subjectContext, requestContext) => {
				if (isFailingItem(requestContext)) {
					throw new Error('spicedb unavailable');
				}
				return { result: { result: true } };
			});
			const client = buildClient(
				{
					instances: TWO_INSTANCES,
					fallbackConfiguration: (requestContext): boolean => {
						if (isFailingItem(requestContext)) {
							throw fallbackError;
						}
						return false;
					}
				},
				queryClient,
				loggingClient
			);

			await client.isEntitledToMany(subjectContext, permissionBatch(), { instanceId: 'a' });

			expect(loggingClient.error.mock.calls.filter(([error]) => error === fallbackError)).toEqual([
				[fallbackError, { instanceId: 'a' }]
			]);
		});

		it('should still answer every item when the logger itself fails', async () => {
			loggingClient.error.mockImplementation(() => {
				throw new Error('logger unavailable');
			});
			queryClient.spiceDBQuery.mockImplementation(async (subjectContext, requestContext) => {
				if (isFailingItem(requestContext)) {
					throw new Error('spicedb unavailable');
				}
				return { result: { result: true } };
			});
			const client = buildClient({ instances: TWO_INSTANCES }, queryClient, loggingClient);

			const results = await client.isEntitledToMany(subjectContext, permissionBatch(), { instanceId: 'a' });

			expect(results).toHaveLength(BATCH_SIZE);
			expect(results[FAILING_ITEM_INDEX]).toEqual({
				result: false,
				error: UNEXPECTED_ITEM_FAILURE_MESSAGE
			});
			expect(results.filter((result) => result.result === true)).toHaveLength(BATCH_SIZE - 1);
		});
	});

	describe('instance configuration logging', () => {
		it.each([
			[
				'a duplicate vendorId',
				[
					{ instanceId: 'a', vendorId: VENDOR_A },
					{ instanceId: 'b', vendorId: VENDOR_A }
				]
			],
			['a vendorId that cannot become a prefix', [{ instanceId: 'a', vendorId: 'ACME' }]]
		])('should log %s once and still throw', (unused, instances) => {
			const construct = (): SpiceDBEntitlementsClient => buildClient({ instances }, queryClient, loggingClient);

			expect(construct).toThrow(ConfigurationInputIsInvalidException);
			expect(loggingClient.error).toHaveBeenCalledTimes(1);
			expect(loggingClient.error).toHaveBeenCalledWith(
				expect.objectContaining({
					action: 'SpiceDBClient:instances:error',
					error: expect.any(ConfigurationInputIsInvalidException)
				})
			);
		});

		it('should log an unknown defaultInstanceId once and still throw', () => {
			const construct = (): SpiceDBEntitlementsClient =>
				buildClient({ instances: TWO_INSTANCES, defaultInstanceId: 'nope' }, queryClient, loggingClient);

			expect(construct).toThrow(ConfigurationInputIsInvalidException);
			expect(loggingClient.error).toHaveBeenCalledTimes(1);
			expect(loggingClient.error).toHaveBeenCalledWith(
				expect.objectContaining({
					action: 'SpiceDBClient:instances:error',
					instanceIds: ['a', 'b'],
					defaultInstanceId: 'nope'
				})
			);
		});
	});

	describe('per-instance fallback', () => {
		it('should prefer the instance fallback over the client fallback', async () => {
			queryClient.spiceDBQuery.mockRejectedValue(new Error('spicedb unavailable'));
			const client = buildClient(
				{
					instances: [
						{ instanceId: 'a', vendorId: VENDOR_A, fallbackConfiguration: { defaultFallback: true } },
						{ instanceId: 'b', vendorId: VENDOR_B }
					],
					fallbackConfiguration: { defaultFallback: false }
				},
				queryClient,
				loggingClient
			);

			await expect(client.isEntitledTo(subjectContext, featureContext, { instanceId: 'a' })).resolves.toEqual({
				result: true
			});
			await expect(client.isEntitledTo(subjectContext, featureContext, { instanceId: 'b' })).resolves.toEqual({
				result: false
			});
		});
	});
});
