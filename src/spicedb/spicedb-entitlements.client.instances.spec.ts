import { SpiceDBEntitlementsClient } from './spicedb-entitlements.client';
import { mock, MockProxy } from 'jest-mock-extended';
import { SpiceDBQueryClient } from './spicedb-queries/spicedb-query.client';
import { LoggingClient } from '../logging';
import { RequestContext, RequestContextType, UserSubjectContext } from '../types';
import { ClientConfiguration } from '../client-configuration';
import { InstanceRegistry } from '../instances/instance-registry';
import { UnknownInstanceException } from '../exceptions/unknown-instance.exception';
import { InstanceIdRequiredException } from '../exceptions/instance-id-required.exception';
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
	const client = new SpiceDBEntitlementsClient(
		full,
		loggingClient,
		false,
		full.fallbackConfiguration,
		new InstanceRegistry(full, full.defaultInstanceId)
	);
	(client as unknown as { spiceDBQueryClient: SpiceDBQueryClient }).spiceDBQueryClient = queryClient;
	return client;
}

describe('SpiceDBEntitlementsClient instance isolation', () => {
	let queryClient: MockProxy<SpiceDBQueryClient>;
	let loggingClient: MockProxy<LoggingClient>;

	beforeEach(() => {
		queryClient = mock<SpiceDBQueryClient>();
		loggingClient = mock<LoggingClient>();
		queryClient.spiceDBQuery.mockResolvedValue({ result: { result: true } });
	});

	describe('scope routing', () => {
		it('should pass the resolved instance scope to the query client', async () => {
			const client = buildClient({ instances: TWO_INSTANCES }, queryClient, loggingClient);

			await client.isEntitledTo(subjectContext, featureContext, { instanceId: 'b' });

			const scope = queryClient.spiceDBQuery.mock.calls[0][2];
			expect(scope.schemaPrefix).toBe(PREFIX_B);
			expect(scope.type('frontegg_feature')).toBe(`${PREFIX_B}/frontegg_feature`);
		});

		it('should route each instanceId to its own prefix', async () => {
			const client = buildClient({ instances: TWO_INSTANCES }, queryClient, loggingClient);

			await client.isEntitledTo(subjectContext, featureContext, { instanceId: 'a' });
			await client.isEntitledTo(subjectContext, featureContext, { instanceId: 'b' });

			expect(queryClient.spiceDBQuery.mock.calls[0][2].schemaPrefix).toBe(PREFIX_A);
			expect(queryClient.spiceDBQuery.mock.calls[1][2].schemaPrefix).toBe(PREFIX_B);
		});

		it('should use a legacy scope when no instances are configured', async () => {
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
			queryClient.spiceDBQuery.mockImplementation(() => {
				throw new ConfigurationInputIsInvalidException(
					"Object type 'v_other/cust_document' must not contain '/'"
				);
			});
			const client = buildClient(
				{ instances: TWO_INSTANCES, fallbackConfiguration: { defaultFallback: true } },
				queryClient,
				loggingClient
			);

			await expect(
				client.isEntitledTo(
					{ entityType: 'v_other/cust_document', key: 'k' },
					{
						type: RequestContextType.Entity,
						entityType: 'v_other/cust_document',
						key: 'doc-1',
						action: 'access'
					},
					{ instanceId: 'a' }
				)
			).rejects.toBeInstanceOf(ConfigurationInputIsInvalidException);
		});

		it('should not swallow a prefix escape from the batch feature path', async () => {
			queryClient.spiceDBBatchFeatureQuery.mockImplementation(() => {
				throw new ConfigurationInputIsInvalidException("Object type 'v_other/x' must not contain '/'");
			});
			const client = buildClient(
				{ instances: TWO_INSTANCES, fallbackConfiguration: { defaultFallback: true } },
				queryClient,
				loggingClient
			);

			await expect(
				client.isEntitledToMany(subjectContext, [featureContext], { instanceId: 'a' })
			).rejects.toBeInstanceOf(ConfigurationInputIsInvalidException);
		});

		it('should still return the fallback for a genuine SpiceDB error', async () => {
			queryClient.spiceDBQuery.mockRejectedValue(new Error('spicedb unavailable'));
			const client = buildClient(
				{ instances: TWO_INSTANCES, fallbackConfiguration: { defaultFallback: true } },
				queryClient,
				loggingClient
			);

			await expect(client.isEntitledTo(subjectContext, featureContext, { instanceId: 'a' })).resolves.toEqual({
				result: true
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

	describe('readSchemaFor', () => {
		const schemaText = [
			`definition ${PREFIX_A}/frontegg_feature {}`,
			`definition ${PREFIX_A}/cust_document {}`,
			`caveat ${PREFIX_A}/targeting(x int) {\n  x == x\n}`,
			`definition ${PREFIX_B}/frontegg_feature {}`,
			`caveat ${PREFIX_B}/targeting(x int) {\n  x == x\n}`
		].join('\n');

		function withSchema(client: SpiceDBEntitlementsClient): void {
			(client as unknown as { spiceClient: { readSchema: jest.Mock } }).spiceClient = {
				readSchema: jest.fn().mockResolvedValue({ schemaText })
			};
		}

		it('should return only the requested instance definitions', async () => {
			const client = buildClient({ instances: TWO_INSTANCES }, queryClient, loggingClient);
			withSchema(client);

			const schema = await client.readSchemaFor('a');

			expect(schema).toContain(`definition ${PREFIX_A}/frontegg_feature`);
			expect(schema).toContain(`caveat ${PREFIX_A}/targeting`);
			expect(schema).not.toContain(PREFIX_B);
		});

		it('should not leak another instance schema', async () => {
			const client = buildClient({ instances: TWO_INSTANCES }, queryClient, loggingClient);
			withSchema(client);

			const schema = await client.readSchemaFor('b');

			expect(schema).toContain(`definition ${PREFIX_B}/frontegg_feature`);
			expect(schema).not.toContain(PREFIX_A);
		});

		it('should return the whole schema for a legacy instance', async () => {
			const client = buildClient({}, queryClient, loggingClient);
			withSchema(client);

			await expect(client.readSchemaFor()).resolves.toBe(schemaText);
		});

		it('should isolate blocks that are indented or preceded by comments', async () => {
			const awkward = [
				'// leading comment',
				`definition ${PREFIX_A}/frontegg_feature {`,
				'\trelation granted: frontegg_tenant',
				'}',
				'',
				'// another comment',
				`definition ${PREFIX_B}/frontegg_feature {`,
				'\trelation granted: frontegg_tenant',
				'}'
			].join('\n');
			const client = buildClient({ instances: TWO_INSTANCES }, queryClient, loggingClient);
			(client as unknown as { spiceClient: { readSchema: jest.Mock } }).spiceClient = {
				readSchema: jest.fn().mockResolvedValue({ schemaText: awkward })
			};

			const schema = await client.readSchemaFor('a');

			expect(schema).toContain(`definition ${PREFIX_A}/frontegg_feature`);
			expect(schema).toContain('relation granted');
			expect(schema).not.toContain(PREFIX_B);
		});

		it('should throw for an unknown instanceId', async () => {
			const client = buildClient({ instances: TWO_INSTANCES }, queryClient, loggingClient);
			withSchema(client);

			await expect(client.readSchemaFor('nope')).rejects.toBeInstanceOf(UnknownInstanceException);
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
