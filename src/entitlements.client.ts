import { EntitlementsResult, OpaResponse, RequestContext, SubjectContext } from './types';
import { LoggingClient } from './logging';
import { EntitlementsOpaQuery } from './opa-queries';

export class EntitlementsClient {
	private static readonly MONITORING_RESULT: EntitlementsResult = { monitoring: true, result: true };

	constructor(
		private readonly opaQueryClient: EntitlementsOpaQuery,
		private readonly loggingClient: LoggingClient,
		private readonly logResults = false
	) {}

	public async isEntitledTo(
		subjectContext: SubjectContext,
		requestContext: RequestContext | RequestContext[]
	): Promise<EntitlementsResult> {
		const res = await this.opaQueryClient.query(subjectContext, requestContext);
		if (res.result.monitoring || this.logResults) {
			await this.loggingClient.log(res);
		}

		if (res.result.monitoring) {
			return EntitlementsClient.MONITORING_RESULT;
		}

		return this.constructResult(res);
	}

	private constructResult(data: OpaResponse<EntitlementsResult>): EntitlementsResult {
		return data?.result; // TODO ? new Authorized(data?.rules) : new NotAuthorized(data?.rules);
	}
}
