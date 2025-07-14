import { EntitlementsSpiceDBQuery } from './entitlements-spicedb.query';
import { EntitlementsDynamicQuery, EntitlementsResult, RequestContextType, UserSubjectContext } from '../../types';
import { SpiceDBResponse } from '../../types/spicedb.dto';
import { v1 } from '@authzed/authzed-node';
import { Cache, createCache } from 'cache-manager';

export class RouteSpiceDBQuery extends EntitlementsSpiceDBQuery {
	private readonly cache: Cache;

	constructor(
		protected readonly client: v1.ZedPromiseClientInterface,
	) {
		super(client);
		this.cache = createCache();
	}

	async query({
		subjectContext,
		requestContext
	}: EntitlementsDynamicQuery<RequestContextType.Route>): Promise<SpiceDBResponse<EntitlementsResult>> {
		const context = subjectContext as UserSubjectContext;
		const request = v1.ReadRelationshipsRequest.create({
			relationshipFilter: {
				resourceType: 'frontegg_route'
			}
		});
		const relations = await this.cache.wrap(
			'routes-relations',
			async () => {
				return this.client.readRelationships(request);
			},
			{ ttl: 30 * 1000 }
		);
		const caveatContext = this.createCaveatContext(context);
		const objects = relations
			.filter((relation) => {
				const objectType = relation.relationship?.resource?.objectType;
				const objectId = relation.relationship?.resource?.objectId;
				const pattern = relation.relationship?.optionalCaveat?.context?.fields['pattern'];
				if (!objectId || !objectType || !pattern) {
					return false;
				}

				if (pattern?.kind?.oneofKind === 'stringValue') {
					return `${requestContext.method} ${requestContext.path}`.match(pattern.kind.stringValue);
				}

				return false;
			})
			.map((relation) => ({
				objectType: relation.relationship?.resource?.objectType,
				objectId: relation.relationship?.resource?.objectId
			})) as { objectType: string; objectId: string }[];

		const bulkRequests = objects.map((object) =>
			this.createBulkPermissionsRequest(object.objectType, object.objectId, context, caveatContext, {
				hashSubjectId: true,
				hashResourceId: false
			})
		);
		const items = bulkRequests.flatMap((request) => request.items);
		const res = await this.client.checkBulkPermissions(v1.CheckBulkPermissionsRequest.create({ items }));
		return {
			result: {
				result: this.processCheckBulkPermissionsResponse(res)
			}
		};
	}
}
