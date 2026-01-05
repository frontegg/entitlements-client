import { EntitlementsSpiceDBQuery } from './entitlements-spicedb.query';
import { createActiveAtCaveatContext } from './caveat-context.utils';
import { EntitlementsDynamicQuery, EntitlementsResult, FGASubjectContext, RequestContextType } from '../../types';
import { SpiceDBResponse } from '../../types/spicedb.dto';
import { v1 } from '@authzed/authzed-node';
import { encodeObjectId } from './base64.utils';
import { LoggingClient } from '../../logging';

export class FgaSpiceDBQuery extends EntitlementsSpiceDBQuery {
	constructor(
		protected readonly client: v1.ZedPromiseClientInterface,
		loggingClient?: LoggingClient,
		logResults: boolean = false
	) {
		super(client, loggingClient, logResults);
	}

	async query({
		requestContext,
		subjectContext
	}: EntitlementsDynamicQuery<RequestContextType.Entity>): Promise<SpiceDBResponse<EntitlementsResult>> {
		const context = subjectContext as FGASubjectContext;
		const caveatContext = createActiveAtCaveatContext(requestContext.at);
		const request = v1.CheckPermissionRequest.create({
			subject: {
				object: {
					objectType: context.entityType,
					objectId: encodeObjectId(context.key)
				},
				optionalRelation: ''
			},
			resource: {
				objectType: requestContext.entityType,
				objectId: encodeObjectId(requestContext.key)
			},
			permission: requestContext.action,
			context: caveatContext
		});

		if (this.logResults) {
			await this.loggingClient?.logRequest(
				{
					action: 'SpiceDB:checkPermission:request',
					objectType: requestContext.entityType,
					objectId: requestContext.key,
					subjectContext: context,
					entityContext: requestContext
				},
				{ request }
			);
		}

		const res = await this.client.checkPermission(request);

		if (this.logResults) {
			await this.loggingClient?.logRequest(
				{
					action: 'SpiceDB:checkPermission:response',
					objectType: requestContext.entityType,
					objectId: requestContext.key,
					entityContext: requestContext
				},
				{ response: res }
			);
		}

		return {
			result: {
				result: res.permissionship === v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION
			}
		};
	}
}
