import { EntitlementsResult, OpaResponse, RequestContext, SubjectContext } from '../types';

export interface LoggingClient {
	log(
		subjectContext: SubjectContext,
		requestContext: RequestContext,
		queryResult: OpaResponse<EntitlementsResult>
	): void | Promise<void>;
	error(error: unknown): void | Promise<void>;
}
