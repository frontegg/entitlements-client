import { EntitlementsOpaQueryCommonTests } from './entitlements-opa-query.spec-helper';
import { RequestContextType } from '../types';
import { PermissionsOpaQuery } from './permissions-opa-query';

describe(PermissionsOpaQuery.name, () => {
	EntitlementsOpaQueryCommonTests(
		PermissionsOpaQuery,
		`/v1/data/e10s/permissions/is_entitled_to_input_permission`,
		() => ({
			type: RequestContextType.Permission,
			permissionKey: 'mock-permission-key'
		})
	);
});
