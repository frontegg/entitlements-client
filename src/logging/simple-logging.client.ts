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

	public logRequest<TRequest, TResponse>(request: TRequest, response: TResponse): void {
		console.log(JSON.stringify({ request, response }, null, 2));
	}

	public error(error: unknown): void {
		console.error(error);
	}
}
