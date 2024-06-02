import { LoggingClient } from './logging-client';
import { EntitlementsResult, OpaResponse } from '../types';

export class SimpleLoggingClient implements LoggingClient {
	public log(queryResult: OpaResponse<EntitlementsResult>): void {
		console.log(queryResult.result);
	}
}
