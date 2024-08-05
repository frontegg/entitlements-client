import {
	EntitlementsResult,
	FeatureEntitlementsContext,
	OpaResponse,
	PermissionsEntitlementsContext,
	RequestContext,
	RequestContextType,
	RouteEntitlementsContext,
	SubjectContext
} from './types';
import { LoggingClient } from './logging';
import { EntitlementsOpaQuery } from './opa-queries';
import { FallbackConfiguration, StaticFallbackConfiguration } from './client-configuration';

export class EntitlementsClient {
	private static readonly MONITORING_RESULT: EntitlementsResult = { monitoring: true, result: true };

	constructor(
		private readonly opaQueryClient: EntitlementsOpaQuery,
		private readonly loggingClient: LoggingClient,
		private readonly logResults = false,
		private readonly fallbackConfiguration: FallbackConfiguration = { defaultFallback: false }
	) {}

	public async isEntitledTo(
		subjectContext: SubjectContext,
		requestContext: RequestContext
	): Promise<EntitlementsResult> {
		try {
			const res = await this.opaQueryClient.query(subjectContext, requestContext);
			if (res.result.monitoring || this.logResults) {
				await this.loggingClient.log(res);
			}

			if (res.result.monitoring) {
				return EntitlementsClient.MONITORING_RESULT;
			}

			return this.constructResult(res);
		} catch (err) {
			await this.loggingClient.error(err);
			return this.constructFallbackResult(requestContext);
		}
	}

	private constructResult(data: OpaResponse<EntitlementsResult>): EntitlementsResult {
		return data?.result;
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
				]
		};

		return fallbackMapper[requestContext.type] ?? staticFallbackConfiguration.defaultFallback;
	}
}
