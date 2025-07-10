import { FeaturesSpiceDBQuery } from './features-spicedb.query';
import { EntitlementsSpiceDBQueryCommonTests } from './entitlements-spicedb.query.spec-helper';
import { EntitlementsDynamicQueryRequestContext, RequestContextType } from '../../types';

describe(FeaturesSpiceDBQuery.name, () => {
	EntitlementsSpiceDBQueryCommonTests<FeaturesSpiceDBQuery, RequestContextType.Feature>(
		FeaturesSpiceDBQuery,
		'feature',
		(requestContext: EntitlementsDynamicQueryRequestContext<RequestContextType.Feature>) =>
			requestContext.featureKey,
		() => ({
			requestContext: { type: RequestContextType.Feature, featureKey: 'mock-feature-key' }
		})
	);
});
