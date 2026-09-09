import { v1 } from '@authzed/authzed-node';
import { encodeObjectId } from './spicedb-queries/base64.utils';

/**
 * Fixture for the FR-26219 isolation suite. Mirrors the shape of the artifacts
 * entitlements-service emits from generateBaseSchema(prefix) — prefixed definitions,
 * prefixed subject types including wildcards and subject relations, and prefixed
 * caveat names (D6 resolved as C1). Caveat signatures match production exactly so
 * tuple and request context shapes are the real ones; the caveat bodies are
 * permissive because these tests assert cross-instance isolation, not targeting
 * semantics, which the unit specs already cover.
 */

export const VENDOR_A = '2f9c1a44-7b0e-4a1e-9f8a-1c2d3e4f5a6b';
export const VENDOR_B = '8b1d0e77-3c5f-4b2d-8e7a-9f0b1c2d3e4f';

export const PREFIX_A = `v_${VENDOR_A.replace(/-/g, '_')}`;
export const PREFIX_B = `v_${VENDOR_B.replace(/-/g, '_')}`;

export const FAR_FUTURE = '2099-01-01T00:00:00Z';

type StructValue = string | number | boolean | null | StructValue[] | { [key: string]: StructValue };

export function toStruct(source: Record<string, StructValue>): v1.PbStruct {
	return v1.createStructFromObject(source);
}

export interface InstanceFixture {
	prefix: string;
	documentRelation: string;
}

export function buildSchemaFor({ prefix, documentRelation }: InstanceFixture): string {
	return `
definition ${prefix}/frontegg_user {}

definition ${prefix}/frontegg_tenant {
	relation member: ${prefix}/frontegg_user
	permission access = member
}

definition ${prefix}/frontegg_feature {
	relation granted: ${prefix}/frontegg_tenant with ${prefix}/targeting | ${prefix}/frontegg_user with ${prefix}/targeting | ${prefix}/frontegg_tenant#member with ${prefix}/targeting | ${prefix}/frontegg_user:* with ${prefix}/targeting | ${prefix}/frontegg_tenant:* with ${prefix}/targeting
	permission access = granted
}

definition ${prefix}/frontegg_route {
	relation apply_all_tenants: ${prefix}/frontegg_tenant:* with ${prefix}/route_regex
	permission access = apply_all_tenants
}

definition ${prefix}/document {
	relation ${documentRelation}: ${prefix}/frontegg_user
	permission read = ${documentRelation}
}

caveat ${prefix}/targeting(rules list<list<map<any>>>, expiration timestamp, user_context map<any>) {
	rules.size() >= 0 && expiration >= timestamp(user_context["now"])
}

caveat ${prefix}/route_regex(pattern string, monitoring bool, policy_type string, priority int) {
	pattern == pattern && monitoring == monitoring && policy_type == policy_type && priority == priority
}

caveat ${prefix}/active_at(at timestamp, activeFrom any, activeUntil any) {
	(activeFrom == null || at >= timestamp(activeFrom)) && (activeUntil == null || at <= timestamp(activeUntil))
}
`;
}

interface TupleSpec {
	resourceType: string;
	resourceId: string;
	relation: string;
	subjectType: string;
	subjectId: string;
	caveatName?: string;
	caveatContext?: Record<string, StructValue>;
}

function toUpdate(spec: TupleSpec): v1.RelationshipUpdate {
	return v1.RelationshipUpdate.create({
		operation: v1.RelationshipUpdate_Operation.TOUCH,
		relationship: v1.Relationship.create({
			resource: { objectType: spec.resourceType, objectId: spec.resourceId },
			relation: spec.relation,
			subject: {
				object: { objectType: spec.subjectType, objectId: spec.subjectId },
				optionalRelation: ''
			},
			optionalCaveat: spec.caveatName
				? v1.ContextualizedCaveat.create({
						caveatName: spec.caveatName,
						context: toStruct(spec.caveatContext ?? {})
					})
				: undefined
		})
	});
}

const targetingContext = { rules: [], expiration: FAR_FUTURE };

/**
 * Both instances deliberately share featureKey 'premium', tenantId 't1' and userId 'u1',
 * and both define a ReBAC type named 'document' with a different relation. Only A grants
 * 'premium'; only A has a tenant-wildcard grant; both declare the same route pattern with
 * opposite policies.
 */
export function seedTuplesFor(fixture: InstanceFixture, granted: boolean): v1.RelationshipUpdate[] {
	const { prefix, documentRelation } = fixture;
	const updates: TupleSpec[] = [
		{
			resourceType: `${prefix}/frontegg_tenant`,
			resourceId: encodeObjectId('t1'),
			relation: 'member',
			subjectType: `${prefix}/frontegg_user`,
			subjectId: encodeObjectId('u1')
		},
		{
			resourceType: `${prefix}/document`,
			resourceId: encodeObjectId(`doc-${granted ? 'a' : 'b'}1`),
			relation: documentRelation,
			subjectType: `${prefix}/frontegg_user`,
			subjectId: encodeObjectId('u1')
		},
		{
			resourceType: `${prefix}/frontegg_route`,
			resourceId: encodeObjectId('r1'),
			relation: 'apply_all_tenants',
			subjectType: `${prefix}/frontegg_tenant`,
			subjectId: '*',
			caveatName: `${prefix}/route_regex`,
			caveatContext: {
				pattern: '^GET /api/reports$',
				policy_type: granted ? 'allow' : 'deny',
				monitoring: false,
				priority: 10
			}
		}
	];

	if (granted) {
		updates.push(
			{
				resourceType: `${prefix}/frontegg_feature`,
				resourceId: encodeObjectId('premium'),
				relation: 'granted',
				subjectType: `${prefix}/frontegg_tenant`,
				subjectId: encodeObjectId('t1'),
				caveatName: `${prefix}/targeting`,
				caveatContext: targetingContext
			},
			{
				resourceType: `${prefix}/frontegg_feature`,
				resourceId: encodeObjectId('beta'),
				relation: 'granted',
				subjectType: `${prefix}/frontegg_tenant`,
				subjectId: '*',
				caveatName: `${prefix}/targeting`,
				caveatContext: targetingContext
			},
			{
				resourceType: `${prefix}/document`,
				resourceId: encodeObjectId('doc-a2'),
				relation: documentRelation,
				subjectType: `${prefix}/frontegg_user`,
				subjectId: encodeObjectId('u1')
			}
		);
	}

	return updates.map(toUpdate);
}
