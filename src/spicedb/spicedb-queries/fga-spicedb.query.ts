import { EntitlementsSpiceDBQuery } from './entitlements-spicedb.query';
import { EntitlementsDynamicQuery, EntitlementsResult, FGASubjectContext, RequestContextType } from '../../types';
import { SpiceDBResponse } from '../../types/spicedb.dto';
import { v1 } from '@authzed/authzed-node';

export class FgaSpiceDBQuery extends EntitlementsSpiceDBQuery {
	constructor(
		protected readonly client: v1.ZedPromiseClientInterface,
	) {
		super(client);
	}

	async query({
		requestContext,
		subjectContext
	}: EntitlementsDynamicQuery<RequestContextType.Entity>): Promise<SpiceDBResponse<EntitlementsResult>> {
		const context = subjectContext as FGASubjectContext;
		const request = v1.CheckPermissionRequest.create({
			subject: {
				object: {
					objectType: context.entityType,
					objectId: this.normalizeObjectId(context.key)
				},
				optionalRelation: ''
			},
			resource: {
				objectType: requestContext.entityType,
				objectId: this.normalizeObjectId(requestContext.key)
			},
			permission: requestContext.action
		});

		const res = await this.client.checkPermission(request);
		return {
			result: {
				result: res.permissionship === v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION
			}
		};
	}
}
