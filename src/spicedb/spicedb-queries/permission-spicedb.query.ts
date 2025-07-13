import { EntitlementsSpiceDBQuery } from './entitlements-spicedb.query';
import { EntitlementsDynamicQuery, EntitlementsResult, RequestContextType, UserSubjectContext } from '../../types';
import { SpiceDBResponse } from '../../types/spicedb.dto';

export class PermissionSpiceDBQuery extends EntitlementsSpiceDBQuery {
	constructor(
		protected readonly spiceDBEndpoint: string,
		protected readonly spiceDBToken: string
	) {
		super(spiceDBEndpoint, spiceDBToken);
	}

	public async query({
		requestContext,
		subjectContext
	}: EntitlementsDynamicQuery<RequestContextType.Permission>): Promise<SpiceDBResponse<EntitlementsResult>> {
		const context = subjectContext as UserSubjectContext;
		return this.executeCommonQuery('frontegg_permission', requestContext.permissionKey, context);
	}
}
