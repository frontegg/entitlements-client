import { EntitlementsResult, OpaResponse, RequestContext, SubjectContext } from '../types';
import { SpiceDBResponse } from '../types/spicedb.dto';

export interface LoggingClient {
	log(
		subjectContext: SubjectContext,
		requestContext: RequestContext,
		queryResult: OpaResponse<EntitlementsResult> | SpiceDBResponse<EntitlementsResult>
	): void | Promise<void>;
	logRequest<TRequest, TResponse>(request: TRequest, response: TResponse): void | Promise<void>;
	error(error: unknown): void | Promise<void>;
}
