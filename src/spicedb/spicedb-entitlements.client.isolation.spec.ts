import { v1 } from '@authzed/authzed-node';
import { EntitlementsClientFactory } from '../entitlements-client-factory';
import { SpiceDBEntitlementsClient } from './spicedb-entitlements.client';
import { RequestContextType } from '../types';
import { UnknownInstanceException } from '../exceptions/unknown-instance.exception';
import { InstanceIdRequiredException } from '../exceptions/instance-id-required.exception';
import { ConfigurationInputIsInvalidException } from '../exceptions/configuration-input-is-invalid.exception';
import { PREFIX_A, PREFIX_B, VENDOR_A, VENDOR_B, buildSchemaFor, seedTuplesFor } from './isolation.spec-helper';

/**
 * FR-26219 isolation suite (plan section 10.2, workstream C table).
 *
 * Runs against a real SpiceDB. It is skipped unless SPICEDB_TEST_ENDPOINT is set, so CI
 * without a SpiceDB service stays green:
 *
 *   spicedb serve --grpc-preshared-key testkey --datastore-engine memory --grpc-addr :50051
 *   SPICEDB_TEST_ENDPOINT=localhost:50051 yarn test -- isolation
 *
 * The four remaining rows of the section 10.2 table (partial_failure_isolated, no_cross_delete,
 * prune_instance, leak_scanner) exercise the syncer's write path and belong to workstream B.
 */

const ENDPOINT = process.env.SPICEDB_TEST_ENDPOINT;
const TOKEN = process.env.SPICEDB_TEST_TOKEN ?? 'testkey';

const describeIsolation = ENDPOINT ? describe : describe.skip;

const INSTANCE_A = 'eu-prod';
const INSTANCE_B = 'us-prod';

const SUBJECT = { tenantId: 't1', userId: 'u1' };

describeIsolation('FR-26219 shared-SpiceDB instance isolation', () => {
	let client: SpiceDBEntitlementsClient;

	const buildClient = (
		instances?: { instanceId: string; vendorId: string }[],
		defaultInstanceId?: string
	): SpiceDBEntitlementsClient =>
		EntitlementsClientFactory.create({
			engineEndpoint: ENDPOINT as string,
			engineToken: TOKEN,
			instances,
			defaultInstanceId,
			fallbackConfiguration: { defaultFallback: false }
		});

	const twoInstances = [
		{ instanceId: INSTANCE_A, vendorId: VENDOR_A },
		{ instanceId: INSTANCE_B, vendorId: VENDOR_B }
	];

	/**
	 * Points at a port with nothing listening. Resolution and scope validation must happen
	 * before any gRPC call, so these paths still raise their own exception here; had the code
	 * reached SpiceDB we would see an UNAVAILABLE gRPC error instead.
	 */
	const buildUnreachableClient = (): SpiceDBEntitlementsClient =>
		EntitlementsClientFactory.create({
			engineEndpoint: '127.0.0.1:1',
			engineToken: TOKEN,
			instances: twoInstances,
			fallbackConfiguration: { defaultFallback: false }
		});

	beforeAll(async () => {
		client = buildClient(twoInstances);

		const schema =
			buildSchemaFor({ prefix: PREFIX_A, documentRelation: 'viewer' }) +
			buildSchemaFor({ prefix: PREFIX_B, documentRelation: 'editor' });

		await client.spiceClient.writeSchema(v1.WriteSchemaRequest.create({ schema }));

		await client.spiceClient.writeRelationships(
			v1.WriteRelationshipsRequest.create({
				updates: [
					...seedTuplesFor({ prefix: PREFIX_A, documentRelation: 'viewer' }, true),
					...seedTuplesFor({ prefix: PREFIX_B, documentRelation: 'editor' }, false)
				]
			})
		);
	});

	describe('same_feature_diverges', () => {
		it('should answer differently per instance for an identical feature key and subject', async () => {
			const underA = await client.isEntitledTo(
				SUBJECT,
				{ type: RequestContextType.Feature, featureKey: 'premium' },
				{ instanceId: INSTANCE_A }
			);
			const underB = await client.isEntitledTo(
				SUBJECT,
				{ type: RequestContextType.Feature, featureKey: 'premium' },
				{ instanceId: INSTANCE_B }
			);

			expect(underA.result).toBe(true);
			expect(underB.result).toBe(false);
		});
	});

	describe('rebac_type_collision', () => {
		it('should keep both document definitions under their own prefix with their own relations', async () => {
			const schemaA = await client.readSchemaFor(INSTANCE_A);
			const schemaB = await client.readSchemaFor(INSTANCE_B);

			expect(schemaA).toContain(`definition ${PREFIX_A}/document`);
			expect(schemaA).toContain('relation viewer');
			expect(schemaA).not.toContain(PREFIX_B);

			expect(schemaB).toContain(`definition ${PREFIX_B}/document`);
			expect(schemaB).toContain('relation editor');
			expect(schemaB).not.toContain(PREFIX_A);
		});

		it('should not let a check under one instance see the other instance document', async () => {
			const underA = await client.isEntitledTo(
				{ entityType: 'frontegg_user', key: 'u1' },
				{ type: RequestContextType.Entity, entityType: 'document', key: 'doc-a1', action: 'read' },
				{ instanceId: INSTANCE_A }
			);
			const underB = await client.isEntitledTo(
				{ entityType: 'frontegg_user', key: 'u1' },
				{ type: RequestContextType.Entity, entityType: 'document', key: 'doc-a1', action: 'read' },
				{ instanceId: INSTANCE_B }
			);

			expect(underA.result).toBe(true);
			expect(underB.result).toBe(false);
		});
	});

	describe('wildcard_scoped', () => {
		it('should not let a tenant wildcard grant under one instance entitle any tenant under the other', async () => {
			const request = { type: RequestContextType.Feature, featureKey: 'beta' } as const;

			const underA = await client.isEntitledTo({ tenantId: 'any-tenant' }, request, {
				instanceId: INSTANCE_A
			});
			const underB = await client.isEntitledTo({ tenantId: 'any-tenant' }, request, {
				instanceId: INSTANCE_B
			});

			expect(underA.result).toBe(true);
			expect(underB.result).toBe(false);
		});
	});

	describe('lookup_scoped', () => {
		it('should never return another instance resource and should strip the prefix from the response', async () => {
			const underA = await client.lookupTargetEntities(
				{
					entityType: 'frontegg_user',
					entityId: 'u1',
					TargetEntityType: 'document',
					action: 'read',
					limit: 50
				},
				{ instanceId: INSTANCE_A }
			);

			const ids = underA.targets.map((target) => target.TargetEntityId).sort();
			expect(ids).toEqual(['doc-a1', 'doc-a2']);

			for (const target of underA.targets) {
				expect(target.TargetEntityType).toBe('document');
				expect(target.TargetEntityType).not.toContain('/');
			}
		});

		it('should return the other instance own resources only', async () => {
			const underB = await client.lookupTargetEntities(
				{
					entityType: 'frontegg_user',
					entityId: 'u1',
					TargetEntityType: 'document',
					action: 'read',
					limit: 50
				},
				{ instanceId: INSTANCE_B }
			);

			expect(underB.targets.map((target) => target.TargetEntityId)).toEqual(['doc-b1']);
		});
	});

	describe('route_scoped', () => {
		it('should resolve identical route patterns independently with no cross-instance cache hit', async () => {
			const request = {
				type: RequestContextType.Route,
				method: 'GET',
				path: '/api/reports'
			} as const;

			const underA = await client.isEntitledTo(SUBJECT, request, { instanceId: INSTANCE_A });
			const underB = await client.isEntitledTo(SUBJECT, request, { instanceId: INSTANCE_B });

			expect(underA.result).toBe(true);
			expect(underB.result).toBe(false);

			// Re-read inside the 30s TTL: the cached entry must still be the instance's own.
			const cachedA = await client.isEntitledTo(SUBJECT, request, { instanceId: INSTANCE_A });
			const cachedB = await client.isEntitledTo(SUBJECT, request, { instanceId: INSTANCE_B });

			expect(cachedA.result).toBe(true);
			expect(cachedB.result).toBe(false);
		});
	});

	describe('unknown_instance_throws', () => {
		it('should throw and make no SpiceDB call for an unconfigured instanceId', async () => {
			await expect(
				buildUnreachableClient().isEntitledTo(
					SUBJECT,
					{ type: RequestContextType.Feature, featureKey: 'premium' },
					{ instanceId: 'not-configured' }
				)
			).rejects.toThrow(UnknownInstanceException);
		});

		it('should throw from a lookup for an unconfigured instanceId', async () => {
			await expect(
				client.lookupTargetEntities(
					{
						entityType: 'frontegg_user',
						entityId: 'u1',
						TargetEntityType: 'document',
						action: 'read',
						limit: 50
					},
					{ instanceId: 'not-configured' }
				)
			).rejects.toThrow(UnknownInstanceException);
		});
	});

	describe('missing_instance_throws', () => {
		it('should throw rather than guess when instanceId is omitted with two instances configured', async () => {
			await expect(
				buildUnreachableClient().isEntitledTo(SUBJECT, {
					type: RequestContextType.Feature,
					featureKey: 'premium'
				})
			).rejects.toThrow(InstanceIdRequiredException);
		});

		it('should resolve without an instanceId when exactly one instance is configured', async () => {
			const single = buildClient([{ instanceId: INSTANCE_A, vendorId: VENDOR_A }]);

			const result = await single.isEntitledTo(SUBJECT, {
				type: RequestContextType.Feature,
				featureKey: 'premium'
			});

			expect(result.result).toBe(true);
		});

		it('should use defaultInstanceId when one is configured', async () => {
			const withDefault = buildClient(twoInstances, INSTANCE_B);

			const result = await withDefault.isEntitledTo(SUBJECT, {
				type: RequestContextType.Feature,
				featureKey: 'premium'
			});

			expect(result.result).toBe(false);
		});
	});

	describe('fga_prefix_escape_rejected', () => {
		it('should reject a resource entityType that carries another instance prefix', async () => {
			await expect(
				buildUnreachableClient().isEntitledTo(
					{ entityType: 'frontegg_user', key: 'u1' },
					{
						type: RequestContextType.Entity,
						entityType: `${PREFIX_B}/document`,
						key: 'doc-b1',
						action: 'read'
					},
					{ instanceId: INSTANCE_A }
				)
			).rejects.toThrow(ConfigurationInputIsInvalidException);
		});

		it('should reject a subject entityType that carries another instance prefix', async () => {
			await expect(
				client.isEntitledTo(
					{ entityType: `${PREFIX_B}/frontegg_user`, key: 'u1' },
					{ type: RequestContextType.Entity, entityType: 'document', key: 'doc-a1', action: 'read' },
					{ instanceId: INSTANCE_A }
				)
			).rejects.toThrow(ConfigurationInputIsInvalidException);
		});

		it('should reject a lookup type that carries another instance prefix', async () => {
			await expect(
				client.lookupTargetEntities(
					{
						entityType: 'frontegg_user',
						entityId: 'u1',
						TargetEntityType: `${PREFIX_B}/document`,
						action: 'read',
						limit: 50
					},
					{ instanceId: INSTANCE_A }
				)
			).rejects.toThrow(ConfigurationInputIsInvalidException);
		});
	});
});
