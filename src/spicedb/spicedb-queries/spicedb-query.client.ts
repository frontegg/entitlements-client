import { EntitlementsSpiceDBQuery } from './entitlements-spicedb.query';
import { EntitlementsResult, RequestContext, RequestContextType, SubjectContext } from '../../types';
import { PermissionSpiceDBQuery } from './permission-spicedb.query';
import { SpiceDBResponse } from '../../types/spicedb.dto';
import { FeaturesSpiceDBQuery } from './features-spicedb.query';
import { FgaSpiceDBQuery } from './fga-spicedb.query';
import { RouteSpiceDBQuery } from './route-spicedb.query';

export class SpiceDBQueryClient {
	private readonly strategy: Record<RequestContextType, EntitlementsSpiceDBQuery>;

	constructor(
		protected readonly spiceDBEndpoint: string,
		protected readonly spiceDBToken: string
	) {
		this.strategy = {
			[RequestContextType.Permission]: new PermissionSpiceDBQuery(spiceDBEndpoint, spiceDBToken),
			[RequestContextType.Feature]: new FeaturesSpiceDBQuery(spiceDBEndpoint, spiceDBToken),
			[RequestContextType.Entity]: new FgaSpiceDBQuery(spiceDBEndpoint, spiceDBToken),
			[RequestContextType.Route]: new RouteSpiceDBQuery(spiceDBEndpoint, spiceDBToken)
		};
	}

	async spiceDBQuery(
		subjectContext: SubjectContext,
		requestContext: RequestContext
	): Promise<SpiceDBResponse<EntitlementsResult>> {
		return this.strategy[requestContext.type].query({ requestContext, subjectContext });
	}
}
