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
	LookupEntitlementsCursorState,
	LookupEntitlementsRequest,
	LookupEntitlementsResponse,
	LookupEntitlementsStream,
	LookupEntitlementsStreamState,
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
	buildLookupEntitlementsRequest
} from './spicedb-queries/lookup-request.builder';
import {
	mapLookupTargetEntitiesResponse,
	mapLookupEntitiesResponse,
	mapLookupEntitlementsResponse
} from './spicedb-queries/lookup-response.mapper';
import { SpiceDBEntities } from '../types/spicedb-consts';
import { decodeObjectId, encodeObjectId } from './spicedb-queries/base64.utils';
import { InstanceRegistry, ResolvedInstance } from '../instances/instance-registry';
import { resolveInstance } from '../instances/resolve-instance';
import { SchemaNamespace } from '../instances/schema-namespace';
import { ConfigurationInputIsInvalidException } from '../exceptions/configuration-input-is-invalid.exception';
import { InvalidObjectTypeException } from '../exceptions/invalid-object-type.exception';

export interface InstanceOptions {
	instanceId?: string;
}

export class SpiceDBEntitlementsClient {
	private static readonly MONITORING_RESULT: EntitlementsResult = { monitoring: true, result: true };
	private readonly spiceClient: v1.ZedPromiseClientInterface;
	private readonly spiceDBQueryClient: SpiceDBQueryClient;

	private readonly registry: InstanceRegistry;

	constructor(
		private readonly configuration: ClientConfiguration,
		private readonly loggingClient: LoggingClient,
		private readonly logResults = false,
		private readonly fallbackConfiguration: FallbackConfiguration = { defaultFallback: false },
		registry?: InstanceRegistry
	) {
		this.registry = registry ?? new InstanceRegistry(configuration);

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
		requestContext: RequestContext,
		options?: InstanceOptions
	): Promise<EntitlementsResult> {
		const instance = this.resolve(options?.instanceId);
		return this.executeEntitlementQuery(subjectContext, requestContext, instance, 'SpiceDB:isEntitledTo');
	}

	public async isEntitledToMany(
		subjectContext: SubjectContext,
		requestContexts: RequestContext[],
		options?: InstanceOptions
	): Promise<EntitlementsManyResult> {
		const instance = this.resolve(options?.instanceId);
		if (this.logResults) {
			await this.loggingClient.logRequest(
				{
					action: 'SpiceDB:isEntitledToMany:request',
					instanceId: instance.instanceId,
					subjectContext,
					requestContexts
				},
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
			this.resolveFeatureEntitlements(subjectContext, featureRequests, instance),
			Promise.all(
				requestContexts.map(async (requestContext, index) => {
					if (requestContext.type === RequestContextType.Feature) {
						return null;
					}

					try {
						return {
							index,
							result: await this.executeEntitlementQuery(subjectContext, requestContext, instance)
						};
					} catch (err) {
						return { index, result: this.toItemFailure(err) };
					}
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
				{
					action: 'SpiceDB:isEntitledToMany:response',
					instanceId: instance.instanceId,
					subjectContext,
					requestContexts
				},
				results
			);
		}

		return results;
	}

	public async lookupTargetEntities(
		req: LookupTargetEntitiesRequest,
		options?: InstanceOptions
	): Promise<LookupTargetEntitiesResponse> {
		const { namespace } = this.resolve(options?.instanceId);
		try {
			const limit = req.limit ? req.limit : DEFAULT_LOOKUP_LIMIT;
			const request = buildLookupTargetEntitiesRequest(
				{
					entityType: req.entityType,
					entityId: req.entityId,
					TargetEntityType: req.TargetEntityType,
					action: req.action,
					limit,
					cursor: req.cursor,
					at: req.at
				},
				namespace
			);

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

	public async lookupEntities(
		req: LookupEntitiesRequest,
		options?: InstanceOptions
	): Promise<LookupEntitiesResponse> {
		const { namespace } = this.resolve(options?.instanceId);
		try {
			const request = buildLookupEntitiesRequest(
				{
					TargetEntityType: req.TargetEntityType,
					TargetEntityId: req.TargetEntityId,
					entityType: req.entityType,
					action: req.action,
					at: req.at
				},
				namespace
			);

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

	public async lookupEntitlements(
		req: LookupEntitlementsRequest,
		options?: InstanceOptions
	): Promise<LookupEntitlementsResponse> {
		const { namespace } = this.resolve(options?.instanceId);
		try {
			if (!(await this.isLookupEntitlementsTenantMember(req, namespace))) {
				return {
					entitlements: [],
					totalReturned: 0,
					cursor: undefined
				};
			}

			const limit = req.limit ? req.limit : DEFAULT_LOOKUP_LIMIT;
			const previousCursor = this.decodeLookupEntitlementsCursor(req.cursor);
			// SpiceDB cursors embed the full request (including the caveat context), so `now` must stay
			// identical across every page. Pin it to the first page and round-trip it through our cursor.
			const now = previousCursor.now ?? new Date().toISOString();
			const streams = this.getLookupEntitlementsStreams(req, previousCursor);
			const activeStreams = streams.filter((stream) => !stream.state.done);
			const requests = activeStreams.map((stream) =>
				buildLookupEntitlementsRequest({ ...req, limit }, stream.subject, namespace, now)
			);
			const resultsByStream = await Promise.all(
				requests.map((request) => this.spiceClient.lookupResources(request))
			);
			const { results, consumedByStream } = this.limitLookupEntitlementsResults(resultsByStream, limit);

			if (this.logResults) {
				await this.loggingClient.logRequest(requests, resultsByStream.flat());
			}

			return {
				...mapLookupEntitlementsResponse(results, req.criteria.type),
				cursor: this.getLookupEntitlementsCursor(
					streams,
					activeStreams,
					resultsByStream,
					consumedByStream,
					limit,
					now
				)
			};
		} catch (err) {
			await this.loggingClient.error(err);
			throw err;
		}
	}

	private async isLookupEntitlementsTenantMember(
		req: LookupEntitlementsRequest,
		namespace: SchemaNamespace
	): Promise<boolean> {
		if (!req.subject.userId) {
			return true;
		}

		const request = v1.CheckPermissionRequest.create({
			resource: {
				objectType: namespace.type(SpiceDBEntities.Tenant),
				objectId: encodeObjectId(req.subject.tenantId)
			},
			permission: 'access',
			subject: {
				object: {
					objectType: namespace.type(SpiceDBEntities.User),
					objectId: encodeObjectId(req.subject.userId)
				},
				optionalRelation: ''
			}
		});
		const result = await this.spiceClient.checkPermission(request);
		return result.permissionship === v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION;
	}

	private resolve(instanceId?: string): ResolvedInstance {
		return resolveInstance(this.registry, instanceId);
	}

	/** Read-only view, not writable back: only definition and caveat blocks survive, so top-level directives are dropped. */
	public async readSchemaFor(instanceId?: string): Promise<string> {
		const { namespace } = this.resolve(instanceId);
		const { schemaText } = await this.spiceClient.readSchema({});

		if (namespace.isLegacy) {
			return schemaText;
		}

		const marker = `${namespace.schemaPrefix}/`;
		return this.splitSchemaBlocks(schemaText)
			.filter((block) => {
				const header = block[0].trim();
				return header.startsWith(`definition ${marker}`) || header.startsWith(`caveat ${marker}`);
			})
			.map((block) => block.join('\n'))
			.join('\n');
	}

	private splitSchemaBlocks(schemaText: string): string[][] {
		const blocks: string[][] = [];
		const scan = { inBlockComment: false };
		let current: string[] | undefined;
		let depth = 0;

		for (const line of schemaText.split('\n')) {
			const trimmed = line.trim();
			const isBlockHeader =
				!scan.inBlockComment && (trimmed.startsWith('definition ') || trimmed.startsWith('caveat '));

			if (depth === 0 && isBlockHeader) {
				current = [line];
				blocks.push(current);
			} else if (current) {
				current.push(line);
			}

			depth += this.braceDelta(line, scan);
			if (depth === 0) {
				current = undefined;
			}
		}

		return blocks;
	}

	private braceDelta(line: string, scan: { inBlockComment: boolean }): number {
		let delta = 0;
		let quote: string | undefined;

		for (let index = 0; index < line.length; index += 1) {
			const char = line[index] as string;
			const next = line[index + 1];

			if (scan.inBlockComment) {
				if (char === '*' && next === '/') {
					scan.inBlockComment = false;
					index += 1;
				}
				continue;
			}

			if (quote !== undefined) {
				if (char === '\\') {
					index += 1;
				} else if (char === quote) {
					quote = undefined;
				}
				continue;
			}

			if (char === '"' || char === "'") {
				quote = char;
			} else if (char === '/' && next === '/') {
				break;
			} else if (char === '/' && next === '*') {
				scan.inBlockComment = true;
				index += 1;
			} else if (char === '{') {
				delta += 1;
			} else if (char === '}') {
				delta -= 1;
			}
		}

		return delta;
	}

	private async executeEntitlementQuery(
		subjectContext: SubjectContext,
		requestContext: RequestContext,
		instance: ResolvedInstance,
		logAction?: string
	): Promise<EntitlementsResult> {
		const logPerItem = this.logResults && logAction != null;
		try {
			if (logPerItem) {
				await this.loggingClient.logRequest(
					{ action: `${logAction}:request`, instanceId: instance.instanceId, subjectContext, requestContext },
					null
				);
			}

			const res = await this.spiceDBQueryClient.spiceDBQuery(subjectContext, requestContext, instance.namespace);

			if (logPerItem) {
				await this.loggingClient.logRequest(
					{
						action: `${logAction}:response`,
						instanceId: instance.instanceId,
						subjectContext,
						requestContext
					},
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
			if (err instanceof ConfigurationInputIsInvalidException || err instanceof InvalidObjectTypeException) {
				throw err;
			}
			await this.loggingClient.error(err);
			return this.constructFallbackResult(requestContext, instance);
		}
	}

	private getLookupEntitlementsStreams(
		req: LookupEntitlementsRequest,
		previousCursor: LookupEntitlementsCursorState
	): LookupEntitlementsStream[] {
		const streams: LookupEntitlementsStream[] = [
			{
				key: 'tenant',
				subject: {
					entityType: SpiceDBEntities.Tenant,
					entityId: req.subject.tenantId,
					cursor: previousCursor.tenant?.token
				},
				state: previousCursor.tenant ?? {}
			}
		];

		if (req.subject.userId) {
			streams.push({
				key: 'user',
				subject: {
					entityType: SpiceDBEntities.User,
					entityId: req.subject.userId,
					cursor: previousCursor.user?.token
				},
				state: previousCursor.user ?? {}
			});
		}

		return streams;
	}

	private limitLookupEntitlementsResults(
		resultsByStream: v1.LookupResourcesResponse[][],
		limit: number
	): { results: v1.LookupResourcesResponse[]; consumedByStream: v1.LookupResourcesResponse[][] } {
		const results: v1.LookupResourcesResponse[] = [];
		const consumedByStream: v1.LookupResourcesResponse[][] = resultsByStream.map(() => []);
		const seenKeys = new Set<string>();

		for (const [streamIndex, streamResults] of resultsByStream.entries()) {
			for (const result of streamResults) {
				consumedByStream[streamIndex].push(result);
				const key = decodeObjectId(result.resourceObjectId);
				if (seenKeys.has(key)) {
					continue;
				}

				seenKeys.add(key);
				results.push(result);
				if (results.length === limit) {
					return { results, consumedByStream };
				}
			}
		}

		return { results, consumedByStream };
	}

	private getLookupEntitlementsCursor(
		streams: LookupEntitlementsStream[],
		activeStreams: LookupEntitlementsStream[],
		resultsByStream: v1.LookupResourcesResponse[][],
		consumedByStream: v1.LookupResourcesResponse[][],
		limit: number,
		now: string
	): string | undefined {
		const nextState: LookupEntitlementsCursorState = {};

		for (const stream of streams) {
			const activeIndex = activeStreams.indexOf(stream);
			if (activeIndex === -1) {
				// Stream was already exhausted before this page; keep it marked done so we never re-query it.
				nextState[stream.key] = { done: true };
				continue;
			}

			nextState[stream.key] = this.getStreamState(
				resultsByStream[activeIndex] ?? [],
				consumedByStream[activeIndex] ?? [],
				limit,
				stream.subject.cursor
			);
		}

		const everyStreamDone = streams.every((stream) => nextState[stream.key]?.done);
		if (everyStreamDone) {
			return undefined;
		}

		return encodeObjectId(JSON.stringify({ ...nextState, now }));
	}

	private getStreamState(
		streamResults: v1.LookupResourcesResponse[],
		consumedResults: v1.LookupResourcesResponse[],
		limit: number,
		previousToken?: string
	): LookupEntitlementsStreamState {
		if (consumedResults.length < streamResults.length) {
			// Stopped mid-stream because the page limit was hit; resume from the last consumed item,
			// or re-query from the same position if nothing from this stream made it onto the page.
			if (consumedResults.length === 0) {
				return { token: previousToken };
			}
			const token = consumedResults[consumedResults.length - 1]?.afterResultCursor?.token;
			return token ? { token } : { done: true };
		}

		// A partial page (fewer results than the limit) or a missing continuation token means the
		// stream is exhausted. Matches the `results.length === limit` convention in the response mapper.
		if (streamResults.length < limit) {
			return { done: true };
		}

		const token = streamResults[streamResults.length - 1]?.afterResultCursor?.token;
		return token ? { token } : { done: true };
	}

	private decodeLookupEntitlementsCursor(cursor?: string): LookupEntitlementsCursorState {
		if (!cursor) {
			return {};
		}

		try {
			const parsed = JSON.parse(decodeObjectId(cursor)) as LookupEntitlementsCursorState;
			return {
				tenant: parsed.tenant,
				user: parsed.user,
				now: parsed.now
			};
		} catch {
			return {};
		}
	}

	private async resolveFeatureEntitlements(
		subjectContext: SubjectContext,
		featureRequests: { requestContext: FeatureEntitlementsContext; index: number }[],
		instance: ResolvedInstance
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
				uniqueFeatureKeys,
				instance.namespace
			);
			return featureRequests.map(({ requestContext, index }) => ({
				index,
				result: res.result[requestContext.featureKey] ?? { result: false }
			}));
		} catch (err) {
			if (err instanceof ConfigurationInputIsInvalidException || err instanceof InvalidObjectTypeException) {
				const failure = this.toItemFailure(err);
				return featureRequests.map(({ index }) => ({ index, result: failure }));
			}
			await this.loggingClient.error(err);
			return Promise.all(
				featureRequests.map(async ({ requestContext, index }) => ({
					index,
					result: await this.constructFallbackResult(requestContext, instance)
				}))
			);
		}
	}

	private toItemFailure(err: unknown): EntitlementsResult {
		if (err instanceof ConfigurationInputIsInvalidException || err instanceof InvalidObjectTypeException) {
			return { error: err.message };
		}

		throw err;
	}

	private async constructFallbackResult(
		requestContext: RequestContext,
		instance?: ResolvedInstance
	): Promise<EntitlementsResult> {
		const configuration = instance?.fallbackConfiguration ?? this.fallbackConfiguration;
		const fallback =
			configuration instanceof Function
				? await configuration(requestContext)
				: this.getStaticFallback(requestContext, configuration);
		return { result: fallback };
	}

	private getStaticFallback(requestContext: RequestContext, configuration: FallbackConfiguration): boolean {
		const staticFallbackConfiguration = configuration as StaticFallbackConfiguration;

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
