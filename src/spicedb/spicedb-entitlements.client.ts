import { ClientConfiguration, FallbackConfiguration, StaticFallbackConfiguration } from '../client-configuration';
import { DEFAULT_LOOKUP_LIMIT } from './lookup.constants';
import {
	EntitlementsResult,
	EntityEntitlementsContext,
	FeatureEntitlementsContext,
	LookupResourcesRequest,
	LookupResourcesResponse,
	LookupSubjectsRequest,
	LookupSubjectsResponse,
	PermissionsEntitlementsContext,
	RequestContext,
	RequestContextType,
	RouteEntitlementsContext,
	SubjectContext
} from '../types';
import { LoggingClient } from '../logging';
import { SpiceDBQueryClient } from './spicedb-queries/spicedb-query.client';
import { v1 } from '@authzed/authzed-node';
import { buildLookupResourcesRequest, buildLookupSubjectsRequest } from './spicedb-queries/lookup-request.builder';
import { mapLookupResourcesResponse, mapLookupSubjectsResponse } from './spicedb-queries/lookup-response.mapper';

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
		try {
			if (this.logResults) {
				await this.loggingClient.logRequest(
					{ action: 'SpiceDB:isEntitledTo:request', subjectContext, requestContext },
					null
				);
			}

			const res = await this.spiceDBQueryClient.spiceDBQuery(subjectContext, requestContext);

			if (this.logResults) {
				await this.loggingClient.logRequest(
					{ action: 'SpiceDB:isEntitledTo:response', subjectContext, requestContext },
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

	public async lookupResources(req: LookupResourcesRequest): Promise<LookupResourcesResponse> {
		try {
			const limit = req.limit ? req.limit : DEFAULT_LOOKUP_LIMIT;
			const request = buildLookupResourcesRequest({
				subjectType: req.subjectType,
				subjectId: req.subjectId,
				resourceType: req.resourceType,
				permission: req.permission,
				limit,
				cursor: req.cursor
			});

			const results = await this.spiceClient.lookupResources(request);

			if (this.logResults) {
				await this.loggingClient.logRequest(request, results);
			}
			return mapLookupResourcesResponse(results, req.resourceType, limit);
		} catch (err) {
			await this.loggingClient.error(err);
			throw err;
		}
	}

	public async lookupSubjects(req: LookupSubjectsRequest): Promise<LookupSubjectsResponse> {
		try {
			const request = buildLookupSubjectsRequest({
				resourceType: req.resourceType,
				resourceId: req.resourceId,
				subjectType: req.subjectType,
				permission: req.permission
			});

			const results = await this.spiceClient.lookupSubjects(request);

			if (this.logResults) {
				await this.loggingClient.logRequest(request, results);
			}
			return mapLookupSubjectsResponse(results, req.subjectType);
		} catch (err) {
			await this.loggingClient.error(err);
			throw err;
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
