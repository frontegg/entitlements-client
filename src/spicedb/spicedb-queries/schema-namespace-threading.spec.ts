import { v1 } from '@authzed/authzed-node';
import { mock, MockProxy } from 'jest-mock-extended';
import { FeaturesSpiceDBQuery } from './features-spicedb.query';
import { PermissionSpiceDBQuery } from './permission-spicedb.query';
import { FgaSpiceDBQuery } from './fga-spicedb.query';
import { RouteSpiceDBQuery } from './route-spicedb.query';
import { RequestContextType, UserSubjectContext, FGASubjectContext } from '../../types';
import { SchemaNamespace } from '../../instances/schema-namespace';
import { InvalidObjectTypeException } from '../../exceptions/invalid-object-type.exception';
import { buildLookupTargetEntitiesRequest, buildLookupEntitiesRequest } from './lookup-request.builder';

const PREFIX = 'v_2f9c1a44_7b0e_4a1e_9f8a_1c2d3e4f5a6b';
const NAMESPACED = new SchemaNamespace(PREFIX);
const LEGACY = new SchemaNamespace('');

const userSubject: UserSubjectContext = {
	tenantId: 'tenant-1',
	userId: 'user-1',
	permissions: ['read.*'],
	attributes: {}
};

function emptyBulkResponse(): v1.CheckBulkPermissionsResponse {
	return v1.CheckBulkPermissionsResponse.create({ pairs: [] });
}

describe('schema namespace threading', () => {
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
		['prefixed', NAMESPACED, `${PREFIX}/`],
		['legacy', LEGACY, '']
	])('%s instance', (_label, namespace, expected) => {
		it('should namespace the feature check request', async () => {
			const query = new FeaturesSpiceDBQuery(client);

			await query.query(
				{
					requestContext: { type: RequestContextType.Feature, featureKey: 'premium' },
					subjectContext: userSubject
				},
				namespace
			);

			const request = client.checkBulkPermissions.mock.calls[0][0];
			expect(request.items[0].resource?.objectType).toBe(`${expected}frontegg_feature`);
			expect(request.items[0].subject?.object?.objectType).toBe(`${expected}frontegg_tenant`);
			expect(request.items[1].subject?.object?.objectType).toBe(`${expected}frontegg_user`);
		});

		it('should namespace the permission linkage lookup', async () => {
			const query = new PermissionSpiceDBQuery(client);

			await query.query(
				{
					requestContext: { type: RequestContextType.Permission, permissionKey: 'read.thing' },
					subjectContext: userSubject
				},
				namespace
			);

			const request = client.lookupSubjects.mock.calls[0][0];
			expect(request.resource?.objectType).toBe(`${expected}frontegg_permission`);
			expect(request.subjectObjectType).toBe(`${expected}frontegg_feature`);
		});

		it('should namespace both sides of an FGA check', async () => {
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
				namespace
			);

			const request = client.checkPermission.mock.calls[0][0];
			expect(request.resource?.objectType).toBe(`${expected}cust_document`);
			expect(request.subject?.object?.objectType).toBe(`${expected}cust_user`);
		});

		it('should namespace the route relationship read', async () => {
			const query = new RouteSpiceDBQuery(client);

			await query.query(
				{
					requestContext: { type: RequestContextType.Route, method: 'GET', path: '/a' },
					subjectContext: userSubject
				},
				namespace
			);

			const request = client.readRelationships.mock.calls[0][0];
			expect(request.relationshipFilter?.resourceType).toBe(`${expected}frontegg_route`);
		});

		it('should namespace both lookup request builders', () => {
			const targets = buildLookupTargetEntitiesRequest(
				{
					entityType: 'cust_user',
					entityId: 'user-1',
					TargetEntityType: 'cust_document',
					action: 'access',
					limit: 10
				},
				namespace
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
				namespace
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
					NAMESPACED
				)
			).rejects.toBeInstanceOf(InvalidObjectTypeException);
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
					NAMESPACED
				)
			).rejects.toBeInstanceOf(InvalidObjectTypeException);
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
					NAMESPACED
				)
			).toThrow(InvalidObjectTypeException);
		});
	});

	describe('route cache isolation', () => {
		it('should not share cached route relationships across instances', async () => {
			const query = new RouteSpiceDBQuery(client);
			const other = new SchemaNamespace('v_8b1d0e77_3c5a_4f2b_9d6e_7a8b9c0d1e2f');
			const requestContext = { type: RequestContextType.Route as const, method: 'GET', path: '/a' };

			await query.query({ requestContext, subjectContext: userSubject }, NAMESPACED);
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

			await query.query({ requestContext, subjectContext: userSubject }, NAMESPACED);
			await query.query({ requestContext, subjectContext: userSubject }, NAMESPACED);

			expect(client.readRelationships).toHaveBeenCalledTimes(1);
		});
	});
});
