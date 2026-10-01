import { EntitlementsResult, RequestContext, SubjectContext } from '../types';
import { SpiceDBResponse } from '../types/spicedb.dto';

export interface LoggingClient {
	log(
		subjectContext: SubjectContext,
		requestContext: RequestContext,
		queryResult: SpiceDBResponse<EntitlementsResult>,
		meta?: { instanceId: string }
	): void | Promise<void>;
	logRequest<TRequest, TResponse>(request: TRequest, response: TResponse): void | Promise<void>;
	error(error: unknown, meta?: { instanceId: string }): void | Promise<void>;
}
