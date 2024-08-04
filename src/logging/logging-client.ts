import { EntitlementsResult, OpaResponse } from '../types';

export interface LoggingClient {
	log(queryResult: OpaResponse<EntitlementsResult>): void | Promise<void>;
	error(error: unknown): void | Promise<void>;
}
