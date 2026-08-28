import { v1 } from '@authzed/authzed-node';
import { mock, MockProxy } from 'jest-mock-extended';
import { FeaturesSpiceDBQuery } from './features-spicedb.query';
import { PermissionSpiceDBQuery } from './permission-spicedb.query';
import { FgaSpiceDBQuery } from './fga-spicedb.query';
import { RouteSpiceDBQuery } from './route-spicedb.query';
import { RequestContextType, UserSubjectContext, FGASubjectContext } from '../../types';
import { SchemaScope } from '../../instances/schema-scope';
import { ConfigurationInputIsInvalidException } from '../../exceptions/configuration-input-is-invalid.exception';
import { buildLookupTargetEntitiesRequest, buildLookupEntitiesRequest } from './lookup-request.builder';

const PREFIX = 'v_2f9c1a44_7b0e_4a1e_9f8a_1c2d3e4f5a6b';
const SCOPED = new SchemaScope(PREFIX);
const LEGACY = new SchemaScope('');

const userSubject: UserSubjectContext = {
	tenantId: 'tenant-1',
	userId: 'user-1',
	permissions: ['read.*'],
	attributes: {}
};

function emptyBulkResponse(): v1.CheckBulkPermissionsResponse {
	return v1.CheckBulkPermissionsResponse.create({ pairs: [] });
}

describe('schema scope threading', () => {
	let client: MockProxy<v1.ZedPromiseClientInterface>;

	beforeEach(() => {
		client = mock<v1.ZedPromiseClientInterface>();
		client.checkBulkPermissions.mockResolvedValue(emptyBulkResponse());
		client.checkPermission.mockResolvedValue(
			v1.CheckPermissionResponse.create({
				permissionship: v1.CheckPermissionResponse_Permissionship.NO_PERMISSION
			})
		);
		client.lookupSubjects.mockResolvedValue([]);
		client.readRelationships.mockResolvedValue([]);
	});

	describe.each([
		['prefixed', SCOPED, `${PREFIX}/`],
		['legacy', LEGACY, '']
	])('%s instance', (_label, scope, expected) => {
		it('should scope the feature check request', async () => {
			const query = new FeaturesSpiceDBQuery(client);

			await query.query(
				{
					requestContext: { type: RequestContextType.Feature, featureKey: 'premium' },
					subjectContext: userSubject
				},
				scope
			);

			const request = client.checkBulkPermissions.mock.calls[0][0];
			expect(request.items[0].resource?.objectType).toBe(`${expected}frontegg_feature`);
			expect(request.items[0].subject?.object?.objectType).toBe(`${expected}frontegg_tenant`);
			expect(request.items[1].subject?.object?.objectType).toBe(`${expected}frontegg_user`);
		});

		it('should scope the permission linkage lookup', async () => {
			const query = new PermissionSpiceDBQuery(client);

			await query.query(
				{
					requestContext: { type: RequestContextType.Permission, permissionKey: 'read.thing' },
					subjectContext: userSubject
				},
				scope
			);

			const request = client.lookupSubjects.mock.calls[0][0];
			expect(request.resource?.objectType).toBe(`${expected}frontegg_permission`);
			expect(request.subjectObjectType).toBe(`${expected}frontegg_feature`);
		});

		it('should scope both sides of an FGA check', async () => {
			const query = new FgaSpiceDBQuery(client);
			const fgaSubject: FGASubjectContext = { entityType: 'cust_user', key: 'user-1' };

			await query.query(
				{
					requestContext: {
						type: RequestContextType.Entity,
						entityType: 'cust_document',
						key: 'doc-1',
						action: 'access'
					},
					subjectContext: fgaSubject
				},
				scope
			);

			const request = client.checkPermission.mock.calls[0][0];
			expect(request.resource?.objectType).toBe(`${expected}cust_document`);
			expect(request.subject?.object?.objectType).toBe(`${expected}cust_user`);
		});

		it('should scope the route relationship read', async () => {
			const query = new RouteSpiceDBQuery(client);

			await query.query(
				{
					requestContext: { type: RequestContextType.Route, method: 'GET', path: '/a' },
					subjectContext: userSubject
				},
				scope
			);

			const request = client.readRelationships.mock.calls[0][0];
			expect(request.relationshipFilter?.resourceType).toBe(`${expected}frontegg_route`);
		});

		it('should scope both lookup request builders', () => {
			const targets = buildLookupTargetEntitiesRequest(
				{
					entityType: 'cust_user',
					entityId: 'user-1',
					TargetEntityType: 'cust_document',
					action: 'access',
					limit: 10
				},
				scope
			);
			expect(targets.resourceObjectType).toBe(`${expected}cust_document`);
			expect(targets.subject?.object?.objectType).toBe(`${expected}cust_user`);

			const entities = buildLookupEntitiesRequest(
				{
					TargetEntityType: 'cust_document',
					TargetEntityId: 'doc-1',
					entityType: 'cust_user',
					action: 'access'
				},
				scope
			);
			expect(entities.resource?.objectType).toBe(`${expected}cust_document`);
			expect(entities.subjectObjectType).toBe(`${expected}cust_user`);
		});
	});

	describe('prefix escape rejection', () => {
		it('should reject an FGA resource entityType containing a prefix separator', async () => {
			const query = new FgaSpiceDBQuery(client);

			await expect(
				query.query(
					{
						requestContext: {
							type: RequestContextType.Entity,
							entityType: 'v_other/cust_document',
							key: 'doc-1',
							action: 'access'
						},
						subjectContext: { entityType: 'cust_user', key: 'user-1' }
					},
					SCOPED
				)
			).rejects.toBeInstanceOf(ConfigurationInputIsInvalidException);
			expect(client.checkPermission).not.toHaveBeenCalled();
		});

		it('should reject an FGA subject entityType containing a prefix separator', async () => {
			const query = new FgaSpiceDBQuery(client);

			await expect(
				query.query(
					{
						requestContext: {
							type: RequestContextType.Entity,
							entityType: 'cust_document',
							key: 'doc-1',
							action: 'access'
						},
						subjectContext: { entityType: 'v_other/cust_user', key: 'user-1' }
					},
					SCOPED
				)
			).rejects.toBeInstanceOf(ConfigurationInputIsInvalidException);
			expect(client.checkPermission).not.toHaveBeenCalled();
		});

		it('should reject a lookup type containing a prefix separator', () => {
			expect(() =>
				buildLookupTargetEntitiesRequest(
					{
						entityType: 'cust_user',
						entityId: 'user-1',
						TargetEntityType: 'v_other/cust_document',
						action: 'access',
						limit: 10
					},
					SCOPED
				)
			).toThrow(ConfigurationInputIsInvalidException);
		});
	});

	describe('route cache isolation', () => {
		it('should not share cached route relationships across instances', async () => {
			const query = new RouteSpiceDBQuery(client);
			const other = new SchemaScope('v_8b1d0e77_3c5a_4f2b_9d6e_7a8b9c0d1e2f');
			const requestContext = { type: RequestContextType.Route as const, method: 'GET', path: '/a' };

			await query.query({ requestContext, subjectContext: userSubject }, SCOPED);
			await query.query({ requestContext, subjectContext: userSubject }, other);

			expect(client.readRelationships).toHaveBeenCalledTimes(2);
			expect(client.readRelationships.mock.calls[0][0].relationshipFilter?.resourceType).toBe(
				`${PREFIX}/frontegg_route`
			);
			expect(client.readRelationships.mock.calls[1][0].relationshipFilter?.resourceType).toBe(
				'v_8b1d0e77_3c5a_4f2b_9d6e_7a8b9c0d1e2f/frontegg_route'
			);
		});

		it('should reuse the cache within one instance', async () => {
			const query = new RouteSpiceDBQuery(client);
			const requestContext = { type: RequestContextType.Route as const, method: 'GET', path: '/a' };

			await query.query({ requestContext, subjectContext: userSubject }, SCOPED);
			await query.query({ requestContext, subjectContext: userSubject }, SCOPED);

			expect(client.readRelationships).toHaveBeenCalledTimes(1);
		});
	});
});
