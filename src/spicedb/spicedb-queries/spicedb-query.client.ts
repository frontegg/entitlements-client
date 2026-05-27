import { EntitlementsSpiceDBQuery } from './entitlements-spicedb.query';
import {
	EntitlementsBatchResult,
	EntitlementsResult,
	RequestContext,
	RequestContextType,
	SubjectContext,
	UserSubjectContext
} from '../../types';
import { PermissionSpiceDBQuery } from './permission-spicedb.query';
import { SpiceDBResponse } from '../../types/spicedb.dto';
import { FeaturesSpiceDBQuery } from './features-spicedb.query';
import { FgaSpiceDBQuery } from './fga-spicedb.query';
import { RouteSpiceDBQuery } from './route-spicedb.query';
import { v1 } from '@authzed/authzed-node';
import { LoggingClient } from '../../logging';

export class SpiceDBQueryClient {
	private readonly strategy: Record<RequestContextType, EntitlementsSpiceDBQuery>;

	constructor(
		private readonly client: v1.ZedPromiseClientInterface,
		loggingClient?: LoggingClient,
		logResults: boolean = false
	) {
		this.strategy = {
			[RequestContextType.Permission]: new PermissionSpiceDBQuery(client, loggingClient, logResults),
			[RequestContextType.Feature]: new FeaturesSpiceDBQuery(client, loggingClient, logResults),
			[RequestContextType.Entity]: new FgaSpiceDBQuery(client, loggingClient, logResults),
			[RequestContextType.Route]: new RouteSpiceDBQuery(client, loggingClient, logResults)
		};
	}

	async spiceDBQuery(
		subjectContext: SubjectContext,
		requestContext: RequestContext
	): Promise<SpiceDBResponse<EntitlementsResult>> {
		return this.strategy[requestContext.type].query({ requestContext, subjectContext });
	}

	async spiceDBBatchFeatureQuery(
		subjectContext: UserSubjectContext,
		featureKeys: string[]
	): Promise<SpiceDBResponse<EntitlementsBatchResult>> {
		return (this.strategy[RequestContextType.Feature] as FeaturesSpiceDBQuery).queryMany(
			subjectContext,
			featureKeys
		);
	}
}
