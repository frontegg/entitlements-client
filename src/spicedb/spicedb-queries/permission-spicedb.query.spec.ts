import { RequestContextType } from '../../types';
import { EntitlementsSpiceDBQueryCommonTests } from './entitlements-spicedb.query.spec-helper';
import { PermissionSpiceDBQuery } from './permission-spicedb.query';

describe(PermissionSpiceDBQuery.name, () => {
	EntitlementsSpiceDBQueryCommonTests<PermissionSpiceDBQuery, RequestContextType.Permission>(
		PermissionSpiceDBQuery,
		'permission',
		(requestContext) => requestContext.permissionKey,
		() => ({
			requestContext: { type: RequestContextType.Permission, permissionKey: 'mock-permission-key' }
		})
	);
});
