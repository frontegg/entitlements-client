import {FeaturesOpaQuery} from './features-opa-query';
import {EntitlementsOpaQueryCommonTests} from './entitlements-opa-query.spec-helper';
import {RequestContextType} from '../types';
 
describe(FeaturesOpaQuery.name, () => {
	EntitlementsOpaQueryCommonTests(
		FeaturesOpaQuery,
		'/v1/data/e10s/features/is_entitled_to_input_feature',
		() => ({
			type: RequestContextType.Feature,
			featureKey: 'mock-feature-key'
		}));
});
