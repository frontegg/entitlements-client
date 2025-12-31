import { EntitlementsSpiceDBQuery } from './entitlements-spicedb.query';
import { EntitlementsDynamicQuery, EntitlementsResult, RequestContextType, UserSubjectContext } from '../../types';
import { SpiceDBResponse } from '../../types/spicedb.dto';
import { v1 } from '@authzed/authzed-node';
import { SpiceDBEntities } from '../../types/spicedb-consts';
import { LoggingClient } from '../../logging';

export class PermissionSpiceDBQuery extends EntitlementsSpiceDBQuery {
	constructor(
		protected readonly client: v1.ZedPromiseClientInterface,
		loggingClient?: LoggingClient,
		logResults: boolean = false
	) {
		super(client, loggingClient, logResults);
	}

	public async query({
		requestContext,
		subjectContext
	}: EntitlementsDynamicQuery<RequestContextType.Permission>): Promise<SpiceDBResponse<EntitlementsResult>> {
		const context = subjectContext as UserSubjectContext;

		if (!this.hasPermission(requestContext.permissionKey, context.permissions)) {
			return {
				result: {
					result: false
				}
			};
		}

		const isPermissionLinkedToFeatures = await this.isPermissionLinkedToFeatures(requestContext);
		if (!isPermissionLinkedToFeatures) {
			return {
				result: {
					result: true
				}
			};
		}
		return this.executeCommonQuery(SpiceDBEntities.Permission, requestContext.permissionKey, context);
	}
}
