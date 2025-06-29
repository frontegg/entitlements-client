import { LoggingClient } from './logging-client';
import { EntitlementsResult, OpaResponse, RequestContext, SubjectContext } from '../types';

export class SimpleLoggingClient implements LoggingClient {
	public log(
		subjectContext: SubjectContext,
		requestContext: RequestContext,
		queryResult: OpaResponse<EntitlementsResult>
	): void {
		console.log({ subjectContext, requestContext, queryResult: queryResult.result });
	}

	public error(error: unknown): void {
		console.error(error);
	}
}
