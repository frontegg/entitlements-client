import { EntitlementsSpiceDBQuery } from './spicedb-queries/entitlements-spicedb.query';
import { FallbackConfiguration, StaticFallbackConfiguration } from '../client-configuration';
import {
	EntitlementsResult,
	EntityEntitlementsContext,
	FeatureEntitlementsContext,
	PermissionsEntitlementsContext,
	RequestContext,
	RequestContextType,
	RouteEntitlementsContext,
	SubjectContext
} from '../types';
import { LoggingClient } from '../logging';
import { SpiceDBQueryClient } from './spicedb-queries/spicedb-query.client';

export class SpiceDBEntitlementsClient {
	constructor(
		private readonly spiceDBQueryClient: SpiceDBQueryClient,
		private readonly loggingClient: LoggingClient,
		private readonly logResults = false,
		private readonly fallbackConfiguration: FallbackConfiguration = { defaultFallback: false }
	) {}

	public async isEntitledTo(
		subjectContext: SubjectContext,
		requestContext: RequestContext
	): Promise<EntitlementsResult> {
		try {
			const res = await this.spiceDBQueryClient.spiceDBQuery(subjectContext, requestContext);
			if (this.logResults) {
				await this.loggingClient.log(subjectContext, requestContext, res);
			}
			return res.result;
		} catch (err) {
			await this.loggingClient.error(err);
			return this.constructFallbackResult(requestContext);
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
