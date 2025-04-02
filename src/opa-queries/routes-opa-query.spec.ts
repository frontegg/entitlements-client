import { EntitlementsOpaQueryCommonTests } from './entitlements-opa-query.spec-helper';
import { RequestContextType } from '../types';
import { RoutesOpaQuery } from './routes-opa-query';

describe(RoutesOpaQuery.name, () => {
	EntitlementsOpaQueryCommonTests(RoutesOpaQuery, `/v1/data/e10s/routes/is_entitled_to_input_route`, () => ({
		requestContext: { type: RequestContextType.Route, method: 'GET', path: '/mock-path' }
	}));
});
