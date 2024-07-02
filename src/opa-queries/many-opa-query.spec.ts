import { EntitlementsOpaQueryCommonTests } from './entitlements-opa-query.spec-helper';
import { RequestContextType } from '../types';
import { ManyOpaQuery } from './many-opa-query';

describe(ManyOpaQuery.name, () => {
	EntitlementsOpaQueryCommonTests(
		ManyOpaQuery,
		`/v1/data/e10s/many/is_entitled_to`,
		() => [
			{
				type: RequestContextType.Route,
				method: 'GET',
				path: '/mock-path'
			},
			{
				type: RequestContextType.Feature,
				featureKey: 'mock-feature-key'
			},
			{
				type: RequestContextType.Permission,
				permissionKey: 'mock-permission-key'
			}
		],
		'requestContextList'
	);
});
