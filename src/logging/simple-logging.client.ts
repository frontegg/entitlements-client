import { LoggingClient } from './logging-client';
import { EntitlementsResult, RequestContext, SubjectContext } from '../types';
import { SpiceDBResponse } from '../types/spicedb.dto';

export class SimpleLoggingClient implements LoggingClient {
	public log(
		subjectContext: SubjectContext,
		requestContext: RequestContext,
		queryResult: SpiceDBResponse<EntitlementsResult>,
		meta?: { instanceId: string }
	): void {
		console.log({ ...meta, subjectContext, requestContext, queryResult: queryResult.result });
	}

	public logRequest<TRequest, TResponse>(request: TRequest, response: TResponse): void {
		console.log(JSON.stringify({ request, response }, null, 2));
	}

	public error(error: unknown, meta?: { instanceId: string }): void {
		if (meta) {
			console.error(error, meta);
			return;
		}
		console.error(error);
	}
}
