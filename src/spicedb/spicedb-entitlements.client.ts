import { ClientConfiguration, FallbackConfiguration, StaticFallbackConfiguration } from '../client-configuration';
import { DEFAULT_LOOKUP_LIMIT } from './lookup.constants';
import {
	EntitlementsManyResult,
	EntitlementsResult,
	EntityEntitlementsContext,
	FeatureEntitlementsContext,
	LookupTargetEntitiesRequest,
	LookupTargetEntitiesResponse,
	LookupEntitiesRequest,
	LookupEntitiesResponse,
	LookupEntitlementsRequest,
	LookupEntitlementsResponse,
	PermissionsEntitlementsContext,
	RequestContext,
	RequestContextType,
	RouteEntitlementsContext,
	SubjectContext,
	UserSubjectContext,
	isFGASubjectContext
} from '../types';
import { LoggingClient } from '../logging';
import { SpiceDBQueryClient } from './spicedb-queries/spicedb-query.client';
import { v1 } from '@authzed/authzed-node';
import {
	buildLookupTargetEntitiesRequest,
	buildLookupEntitiesRequest,
	buildLookupEntitlementsRequest,
	LookupEntitlementsSubject
} from './spicedb-queries/lookup-request.builder';
import {
	mapLookupTargetEntitiesResponse,
	mapLookupEntitiesResponse,
	mapLookupEntitlementsResponse
} from './spicedb-queries/lookup-response.mapper';
import { SpiceDBEntities } from '../types/spicedb-consts';
import { decodeObjectId, encodeObjectId } from './spicedb-queries/base64.utils';

export class SpiceDBEntitlementsClient {
	private static readonly MONITORING_RESULT: EntitlementsResult = { monitoring: true, result: true };
	public readonly spiceClient: v1.ZedPromiseClientInterface;
	private readonly spiceDBQueryClient: SpiceDBQueryClient;

	constructor(
		private readonly configuration: ClientConfiguration,
		private readonly loggingClient: LoggingClient,
		private readonly logResults = false,
		private readonly fallbackConfiguration: FallbackConfiguration = { defaultFallback: false }
	) {
		try {
			this.spiceClient = v1.NewClient(
				this.configuration.engineToken,
				this.configuration.engineEndpoint,
				v1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS
			).promises;

			this.spiceDBQueryClient = new SpiceDBQueryClient(this.spiceClient, this.loggingClient, this.logResults);
		} catch (initError) {
			void this.loggingClient.error({
				action: 'SpiceDBClient:init:error',
				endpoint: this.configuration.engineEndpoint,
				error: initError,
				message: 'Failed to initialize SpiceDB client'
			});
			throw initError;
		}
	}

	public async isEntitledTo(
		subjectContext: SubjectContext,
		requestContext: RequestContext
	): Promise<EntitlementsResult> {
		return this.executeEntitlementQuery(subjectContext, requestContext, 'SpiceDB:isEntitledTo');
	}

	public async isEntitledToMany(
		subjectContext: SubjectContext,
		requestContexts: RequestContext[]
	): Promise<EntitlementsManyResult> {
		if (this.logResults) {
			await this.loggingClient.logRequest(
				{ action: 'SpiceDB:isEntitledToMany:request', subjectContext, requestContexts },
				null
			);
		}

		const featureRequests = requestContexts
			.map((requestContext, index) => ({ requestContext, index }))
			.filter(
				(
					request
				): request is {
					requestContext: FeatureEntitlementsContext;
					index: number;
				} => request.requestContext.type === RequestContextType.Feature
			);

		if (featureRequests.length && isFGASubjectContext(subjectContext)) {
			throw new Error('Feature entitlement requests require user subject context');
		}

		const [featureResults, nonFeatureResults] = await Promise.all([
			this.resolveFeatureEntitlements(subjectContext, featureRequests),
			Promise.all(
				requestContexts.map(async (requestContext, index) => {
					if (requestContext.type === RequestContextType.Feature) {
						return null;
					}

					return {
						index,
						result: await this.executeEntitlementQuery(subjectContext, requestContext)
					};
				})
			)
		]);

		const results: EntitlementsManyResult = new Array(requestContexts.length);
		for (const item of [...featureResults, ...nonFeatureResults]) {
			if (item) {
				results[item.index] = item.result;
			}
		}

		if (this.logResults) {
			await this.loggingClient.logRequest(
				{ action: 'SpiceDB:isEntitledToMany:response', subjectContext, requestContexts },
				results
			);
		}

		return results;
	}

	public async lookupTargetEntities(req: LookupTargetEntitiesRequest): Promise<LookupTargetEntitiesResponse> {
		try {
			const limit = req.limit ? req.limit : DEFAULT_LOOKUP_LIMIT;
			const request = buildLookupTargetEntitiesRequest({
				entityType: req.entityType,
				entityId: req.entityId,
				TargetEntityType: req.TargetEntityType,
				action: req.action,
				limit,
				cursor: req.cursor,
				at: req.at
			});

			const results = await this.spiceClient.lookupResources(request);

			if (this.logResults) {
				await this.loggingClient.logRequest(request, results);
			}
			return mapLookupTargetEntitiesResponse(results, req.TargetEntityType, limit);
		} catch (err) {
			await this.loggingClient.error(err);
			throw err;
		}
	}

	public async lookupEntities(req: LookupEntitiesRequest): Promise<LookupEntitiesResponse> {
		try {
			const request = buildLookupEntitiesRequest({
				TargetEntityType: req.TargetEntityType,
				TargetEntityId: req.TargetEntityId,
				entityType: req.entityType,
				action: req.action,
				at: req.at
			});

			const results = await this.spiceClient.lookupSubjects(request);

			if (this.logResults) {
				await this.loggingClient.logRequest(request, results);
			}
			return mapLookupEntitiesResponse(results, req.entityType);
		} catch (err) {
			await this.loggingClient.error(err);
			throw err;
		}
	}

	public async lookupEntitlements(req: LookupEntitlementsRequest): Promise<LookupEntitlementsResponse> {
		try {
			if (!(await this.isLookupEntitlementsTenantMember(req))) {
				return {
					entitlements: [],
					totalReturned: 0,
					cursor: undefined
				};
			}

			const limit = req.limit ? req.limit : DEFAULT_LOOKUP_LIMIT;
			const subjects = this.getLookupEntitlementsSubjects(req);
			const requests = subjects.map((subject) => buildLookupEntitlementsRequest({ ...req, limit }, subject));
			const resultsBySubject = await Promise.all(
				requests.map((request) => this.spiceClient.lookupResources(request))
			);
			const results = resultsBySubject.flat();

			if (this.logResults) {
				await this.loggingClient.logRequest(requests, results);
			}

			return {
				...mapLookupEntitlementsResponse(results, req.criteria.type),
				cursor: this.getLookupEntitlementsCursor(resultsBySubject, limit)
			};
		} catch (err) {
			await this.loggingClient.error(err);
			throw err;
		}
	}

	private async isLookupEntitlementsTenantMember(req: LookupEntitlementsRequest): Promise<boolean> {
		if (!req.subject.userId) {
			return true;
		}

		const request = v1.CheckPermissionRequest.create({
			resource: {
				objectType: SpiceDBEntities.Tenant,
				objectId: encodeObjectId(req.subject.tenantId)
			},
			permission: 'access',
			subject: {
				object: {
					objectType: SpiceDBEntities.User,
					objectId: encodeObjectId(req.subject.userId)
				},
				optionalRelation: ''
			}
		});
		const result = await this.spiceClient.checkPermission(request);
		return result.permissionship === v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION;
	}

	private async executeEntitlementQuery(
		subjectContext: SubjectContext,
		requestContext: RequestContext,
		logAction?: string
	): Promise<EntitlementsResult> {
		const logPerItem = this.logResults && logAction != null;
		try {
			if (logPerItem) {
				await this.loggingClient.logRequest(
					{ action: `${logAction}:request`, subjectContext, requestContext },
					null
				);
			}

			const res = await this.spiceDBQueryClient.spiceDBQuery(subjectContext, requestContext);

			if (logPerItem) {
				await this.loggingClient.logRequest(
					{ action: `${logAction}:response`, subjectContext, requestContext },
					res
				);
			}

			if (res.result.monitoring || this.logResults) {
				await this.loggingClient.log(subjectContext, requestContext, res);
			}

			if (res.result.monitoring) {
				return SpiceDBEntitlementsClient.MONITORING_RESULT;
			}
			return res.result;
		} catch (err) {
			await this.loggingClient.error(err);
			return this.constructFallbackResult(requestContext);
		}
	}

	private getLookupEntitlementsSubjects(req: LookupEntitlementsRequest): LookupEntitlementsSubject[] {
		const cursor = this.decodeLookupEntitlementsCursor(req.cursor);
		const subjects: LookupEntitlementsSubject[] = [
			{
				entityType: SpiceDBEntities.Tenant,
				entityId: req.subject.tenantId,
				cursor: cursor.tenant
			}
		];

		if (req.subject.userId) {
			subjects.push({
				entityType: SpiceDBEntities.User,
				entityId: req.subject.userId,
				cursor: cursor.user
			});
		}

		return subjects;
	}

	private getLookupEntitlementsCursor(
		resultsBySubject: v1.LookupResourcesResponse[][],
		limit: number
	): string | undefined {
		const [tenantResults, userResults] = resultsBySubject;
		const tenant = this.getLookupResourcesCursor(tenantResults ?? [], limit);
		const user = this.getLookupResourcesCursor(userResults ?? [], limit);

		if (!tenant && !user) {
			return undefined;
		}

		return encodeObjectId(JSON.stringify({ tenant, user }));
	}

	private getLookupResourcesCursor(results: v1.LookupResourcesResponse[], limit: number): string | undefined {
		if (results.length !== limit) {
			return undefined;
		}

		return results[results.length - 1]?.afterResultCursor?.token;
	}

	private decodeLookupEntitlementsCursor(cursor?: string): { tenant?: string; user?: string } {
		if (!cursor) {
			return {};
		}

		try {
			const parsed = JSON.parse(decodeObjectId(cursor)) as { tenant?: string; user?: string };
			return {
				tenant: parsed.tenant,
				user: parsed.user
			};
		} catch {
			return {};
		}
	}

	private async resolveFeatureEntitlements(
		subjectContext: SubjectContext,
		featureRequests: { requestContext: FeatureEntitlementsContext; index: number }[]
	): Promise<{ index: number; result: EntitlementsResult }[]> {
		if (!featureRequests.length) {
			return [];
		}

		const uniqueFeatureKeys = Array.from(
			new Set(featureRequests.map(({ requestContext }) => requestContext.featureKey))
		);

		try {
			const res = await this.spiceDBQueryClient.spiceDBBatchFeatureQuery(
				subjectContext as UserSubjectContext,
				uniqueFeatureKeys
			);
			return featureRequests.map(({ requestContext, index }) => ({
				index,
				result: res.result[requestContext.featureKey] ?? { result: false }
			}));
		} catch (err) {
			await this.loggingClient.error(err);
			return Promise.all(
				featureRequests.map(async ({ requestContext, index }) => ({
					index,
					result: await this.constructFallbackResult(requestContext)
				}))
			);
		}
	}

	private async constructFallbackResult(requestContext: RequestContext): Promise<EntitlementsResult> {
		const fallback =
			this.fallbackConfiguration instanceof Function
				? await this.fallbackConfiguration(requestContext)
				: this.getStaticFallback(requestContext);
		return { result: fallback };
	}

	private getStaticFallback(requestContext: RequestContext): boolean {
		const staticFallbackConfiguration = this.fallbackConfiguration as StaticFallbackConfiguration;

		const fallbackMapper = {
			[RequestContextType.Feature]:
				staticFallbackConfiguration[RequestContextType.Feature]?.[
					(requestContext as FeatureEntitlementsContext).featureKey
				],
			[RequestContextType.Permission]:
				staticFallbackConfiguration[RequestContextType.Permission]?.[
					(requestContext as PermissionsEntitlementsContext).permissionKey
				],
			[RequestContextType.Route]:
				staticFallbackConfiguration[RequestContextType.Route]?.[
					`${(requestContext as RouteEntitlementsContext).method}_${(requestContext as RouteEntitlementsContext).path}`
				],
			[RequestContextType.Entity]:
				staticFallbackConfiguration[RequestContextType.Entity]?.[
					`${(requestContext as EntityEntitlementsContext).entityType}:${(requestContext as EntityEntitlementsContext).key}@${(requestContext as EntityEntitlementsContext).action}`
				]
		};

		return fallbackMapper[requestContext.type] ?? staticFallbackConfiguration.defaultFallback;
	}
}
