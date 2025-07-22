import { EntitlementsSpiceDBQuery } from './entitlements-spicedb.query';
import { EntitlementsDynamicQuery, EntitlementsResult, RequestContextType, UserSubjectContext } from '../../types';
import { SpiceDBResponse } from '../../types/spicedb.dto';
import { v1 } from '@authzed/authzed-node';
import { Cache, createCache } from 'cache-manager';
import { SpiceDBEntities } from '../../types/spicedb-consts';

export class RouteSpiceDBQuery extends EntitlementsSpiceDBQuery {
	private readonly cache: Cache;

	constructor(protected readonly client: v1.ZedPromiseClientInterface) {
		super(client);
		this.cache = createCache();
	}

	private createResult(allowed: boolean, isMonitoringEnabled: boolean): SpiceDBResponse<EntitlementsResult> {
		const result: EntitlementsResult = { result: allowed };

		if (isMonitoringEnabled) {
			result.monitoring = true;
		}

		return { result };
	}

	async query({
		subjectContext,
		requestContext
	}: EntitlementsDynamicQuery<RequestContextType.Route>): Promise<SpiceDBResponse<EntitlementsResult>> {
		const context = subjectContext as UserSubjectContext;
		let isMonitoringEnabled = false;
		const request = v1.ReadRelationshipsRequest.create({
			relationshipFilter: {
				resourceType: SpiceDBEntities.Route
			}
		});
		const relations = await this.cache.wrap(
			'routes-relations',
			async () => {
				return this.client.readRelationships(request);
			},
			{ ttl: 30 * 1000 }
		);
		let objects = relations
			.filter((relation) => {
				const objectType = relation.relationship?.resource?.objectType;
				const objectId = relation.relationship?.resource?.objectId;
				const pattern = relation.relationship?.optionalCaveat?.context?.fields['pattern'];
				const monitoring = relation.relationship?.optionalCaveat?.context?.fields['monitoring'];

				if (!objectId || !objectType || !pattern) {
					return false;
				}
				isMonitoringEnabled = monitoring?.kind?.oneofKind === 'boolValue' ? monitoring.kind.boolValue : false;

				if (pattern?.kind?.oneofKind === 'stringValue') {
					return `${requestContext.method} ${requestContext.path}`.match(pattern.kind.stringValue);
				}

				return false;
			})
			.map((relation) => {
				const policyTypeValue = relation.relationship?.optionalCaveat?.context?.fields['policy_type'];
				const policyType =
					policyTypeValue?.kind?.oneofKind === 'stringValue' ? policyTypeValue?.kind.stringValue : 'allow';
				const priorityValue = relation.relationship?.optionalCaveat?.context?.fields['priority'];
				const priority = priorityValue?.kind?.oneofKind === 'numberValue' ? priorityValue?.kind.numberValue : 0;

				return {
					relation: relation.relationship?.relation,
					resourceType: relation.relationship?.resource?.objectType,
					resourceId: relation.relationship?.resource?.objectId,
					subjectId: relation.relationship?.subject?.object?.objectId,
					policyType,
					priority
				};
			}) as {
			relation: string;
			resourceType: string;
			resourceId: string;
			subjectId: string;
			policyType: string;
			priority: number;
		}[];

		if (!objects.length) {
			return this.createResult(false, isMonitoringEnabled);
		}

		objects.sort((a, b) => b.priority - a.priority);

		let firstRule = objects[0];
		if (firstRule.policyType === 'deny' || firstRule.policyType === 'allow') {
			return this.createResult(firstRule.policyType === 'allow', isMonitoringEnabled);
		}

		objects = objects.filter((rule) => rule.policyType === 'ruleBased');
		firstRule = objects[0];

		for (const rule of objects) {
			const hashedPermissions = context.permissions?.map((permission) => this.normalizeObjectId(permission));
			if (rule.relation.includes('required_permission')) {
				if (!this.hasPermission(rule.subjectId, hashedPermissions)) {
					return this.createResult(false, isMonitoringEnabled);
				}
			}
		}

		const caveatContext = this.createCaveatContext(context);

		const bulkRequest = this.createBulkPermissionsRequest(
			firstRule.resourceType,
			firstRule.resourceId,
			context,
			caveatContext,
			{
				hashSubjectId: true,
				hashResourceId: false
			}
		);
		const res = await this.client.checkBulkPermissions(bulkRequest);
		return this.createResult(this.processCheckBulkPermissionsResponse(res), isMonitoringEnabled);
	}
}
