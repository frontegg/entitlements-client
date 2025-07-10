import { EntitlementsDynamicQueryRequestContext, RequestContextType } from '../../types';
import { EntitlementsSpiceDBQueryCommonTests } from './entitlements-spicedb.query.spec-helper';
import { FgaSpiceDBQuery } from './fga-spicedb.query';

describe(FgaSpiceDBQuery.name, () => {
	EntitlementsSpiceDBQueryCommonTests<FgaSpiceDBQuery, RequestContextType.Entity>(
		FgaSpiceDBQuery,
		'document',
		(requestContext: EntitlementsDynamicQueryRequestContext<RequestContextType.Entity>) => requestContext.key,
		() => ({
			requestContext: { type: RequestContextType.Entity, entityType: 'document', key: 'doc-1', action: 'read' },
			subjectContext: { entityType: 'user', key: 'user-1' }
		})
	);
});
