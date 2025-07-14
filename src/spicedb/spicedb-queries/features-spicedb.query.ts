import { EntitlementsSpiceDBQuery } from './entitlements-spicedb.query';
import { EntitlementsDynamicQuery, EntitlementsResult, RequestContextType, UserSubjectContext } from '../../types';
import { SpiceDBResponse } from '../../types/spicedb.dto';

export class FeaturesSpiceDBQuery extends EntitlementsSpiceDBQuery {
	constructor(
		protected readonly spiceDBEndpoint: string,
		protected readonly spiceDBToken: string
	) {
		super(spiceDBEndpoint, spiceDBToken);
	}

	async query({
		subjectContext,
		requestContext
	}: EntitlementsDynamicQuery<RequestContextType.Feature>): Promise<SpiceDBResponse<EntitlementsResult>> {
		const context = subjectContext as UserSubjectContext;
		return this.executeCommonQuery('frontegg_feature', requestContext.featureKey, context);
	}
}
