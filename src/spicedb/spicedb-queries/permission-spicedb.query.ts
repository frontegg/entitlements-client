import { EntitlementsSpiceDBQuery } from './entitlements-spicedb.query';
import { EntitlementsDynamicQuery, EntitlementsResult, RequestContextType, UserSubjectContext } from '../../types';
import { SpiceDBResponse } from '../../types/spicedb.dto';
import { v1 } from '@authzed/authzed-node';
import { SpiceDBEntities } from '../../types/spicedb-consts';

export class PermissionSpiceDBQuery extends EntitlementsSpiceDBQuery {
	constructor(protected readonly client: v1.ZedPromiseClientInterface) {
		super(client);
	}

	public async query({
		requestContext,
		subjectContext
	}: EntitlementsDynamicQuery<RequestContextType.Permission>): Promise<SpiceDBResponse<EntitlementsResult>> {
		const context = subjectContext as UserSubjectContext;

		if (context.permissions?.length && !this.hasPermission(context.permissions, requestContext.permissionKey)) {
			return {
				result: {
					result: false
				}
			};
		}

		return this.executeCommonQuery(SpiceDBEntities.Permission, requestContext.permissionKey, context);
	}

	private hasPermission(permissions: string[], permissionKey: string): boolean {
		return permissions.some((permission) => {
			const escapedPermission = permission.replace(/\./g, '\\.').replace(/\*/g, '.+');
			const regex = new RegExp(`^${escapedPermission}$`);
			return regex.test(permissionKey);
		});
	}
}
