import { RequestContextType } from '../types';
import { EntitlementsOpaQueryCommonTests } from './entitlements-opa-query.spec-helper';
import { FGAOpaQuery } from './fga-opa-query';
describe(FGAOpaQuery.name, () => {
	EntitlementsOpaQueryCommonTests(FGAOpaQuery, '/v1/data/e10s/fga/is_entitled_to_target', () => ({
		requestContext: { type: RequestContextType.Entity, entityType: 'document', key: 'doc-1', action: 'read' },
		subjectContext: { entityType: 'user', key: 'user-1' }
	}));
});
