import { EntitlementsResult, OpaResponse, RequestContext, RequestContextType, SubjectContext } from './types';
import { LoggingClient } from './logging';
import { EntitlementsOpaQuery } from './opa-queries';
import { FallbackConfiguration } from './client-configuration';

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

	private constructFallbackResult(requestContext: RequestContext): EntitlementsResult {
		const { defaultFallback } = this.fallbackConfiguration;
		let specificFallback: boolean | undefined;
		switch (requestContext.type) {
			case RequestContextType.Feature: {
				specificFallback = this.fallbackConfiguration[RequestContextType.Feature]?.[requestContext.featureKey];
				break;
			}
			case RequestContextType.Permission: {
				specificFallback =
					this.fallbackConfiguration[RequestContextType.Permission]?.[requestContext.permissionKey];
				break;
			}
			case RequestContextType.Route: {
				specificFallback =
					this.fallbackConfiguration[RequestContextType.Route]?.[
						`${requestContext.method}_${requestContext.path}`
					];
				break;
			}
		}
		return {
			result: specificFallback !== undefined ? specificFallback : defaultFallback
		};
	}
}
