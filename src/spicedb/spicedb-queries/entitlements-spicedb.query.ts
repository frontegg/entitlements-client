import { v1 } from '@authzed/authzed-node';
import {
	EntitlementsBatchResult,
	EntitlementsDynamicQuery,
	EntitlementsResult,
	PermissionsEntitlementsContext,
	RequestContextType,
	UserSubjectContext
} from '../../types';
import { SpiceDBResponse } from '../../types/spicedb.dto';
import { SpiceDBEntities } from '../../types/spicedb-consts';
import { decodeObjectId, encodeObjectId } from './base64.utils';
import { LoggingClient } from '../../logging';

export interface HashOptions {
	hashResourceId: boolean;
	hashSubjectId: boolean;
}

export abstract class EntitlementsSpiceDBQuery {
	protected constructor(
		protected readonly client: v1.ZedPromiseClientInterface,
		protected readonly loggingClient?: LoggingClient,
		protected readonly logResults: boolean = false
	) {}

	abstract query(
		entitlementsQuery: EntitlementsDynamicQuery<RequestContextType>
	): Promise<SpiceDBResponse<EntitlementsResult>>;

	protected createCaveatContext(context: UserSubjectContext): v1.PbStruct {
		return {
			fields: {
				user_context: {
					kind: {
						oneofKind: 'structValue',
						structValue: {
							fields: {
								now: {
									kind: {
										oneofKind: 'stringValue',
										stringValue: new Date().toISOString()
									}
								},
								...Object.entries(context.attributes ?? {}).reduce<
									Record<string, { kind: { oneofKind: 'stringValue'; stringValue: string } }>
								>((acc, [attrName, attrValue]) => {
									acc[attrName] = {
										kind: {
											oneofKind: 'stringValue',
											stringValue: String(attrValue)
										}
									};
									return acc;
								}, {})
							}
						}
					}
				}
			}
		};
	}

	protected createBulkPermissionRequestItem(
		resourceObjectType: string,
		resourceObjectId: string,
		subjectObjectType: string,
		subjectObjectId: string,
		caveatContext: v1.PbStruct,
		hashOptions: HashOptions = { hashSubjectId: true, hashResourceId: true }
	): v1.CheckBulkPermissionsRequestItem {
		return {
			resource: {
				objectType: resourceObjectType,
				objectId: hashOptions.hashResourceId ? encodeObjectId(resourceObjectId) : resourceObjectId
			},
			permission: 'access',
			subject: {
				object: {
					objectType: subjectObjectType,
					objectId: hashOptions.hashSubjectId ? encodeObjectId(subjectObjectId) : subjectObjectId
				},
				optionalRelation: ''
			},
			context: caveatContext
		};
	}

	protected createBulkPermissionsRequest(
		objectType: string,
		objectId: string,
		context: UserSubjectContext,
		caveatContext: v1.PbStruct,
		hashOptions: HashOptions = { hashSubjectId: true, hashResourceId: true }
	): v1.CheckBulkPermissionsRequest {
		const tenantRequest = this.createBulkPermissionRequestItem(
			objectType,
			objectId,
			SpiceDBEntities.Tenant,
			context.tenantId,
			caveatContext,
			hashOptions
		);

		return v1.CheckBulkPermissionsRequest.create({
			items: context.userId
				? [
						tenantRequest,
						this.createBulkPermissionRequestItem(
							objectType,
							objectId,
							SpiceDBEntities.User,
							context.userId,
							caveatContext
						)
					]
				: [tenantRequest]
		});
	}

	protected createManyBulkPermissionsRequest(
		objectType: string,
		objectIds: string[],
		context: UserSubjectContext,
		caveatContext: v1.PbStruct,
		hashOptions: HashOptions = { hashSubjectId: true, hashResourceId: true }
	): v1.CheckBulkPermissionsRequest {
		return v1.CheckBulkPermissionsRequest.create({
			items: objectIds.flatMap(
				(objectId) =>
					this.createBulkPermissionsRequest(objectType, objectId, context, caveatContext, hashOptions).items
			)
		});
	}

	protected processCheckBulkPermissionsResponse(res: v1.CheckBulkPermissionsResponse): boolean {
		return res.pairs.some(
			(pair) =>
				pair.response.oneofKind === 'item' &&
				pair.response.item.permissionship === v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION
		);
	}

	protected processManyCheckBulkPermissionsResponse(
		res: v1.CheckBulkPermissionsResponse,
		objectIds: string[],
		hashResourceId: boolean = true
	): EntitlementsBatchResult {
		const results = objectIds.reduce<EntitlementsBatchResult>((mappedResults, objectId) => {
			mappedResults[objectId] = { result: false };
			return mappedResults;
		}, {});

		for (const pair of res.pairs) {
			const resourceObjectId = pair.request?.resource?.objectId;
			if (!resourceObjectId) {
				continue;
			}

			const objectId = hashResourceId ? decodeObjectId(resourceObjectId) : resourceObjectId;
			if (!results[objectId]) {
				continue;
			}

			const hasPermission =
				pair.response.oneofKind === 'item' &&
				pair.response.item.permissionship === v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION;
			if (hasPermission) {
				results[objectId] = { result: true };
			}
		}

		return results;
	}

	protected async executeCommonQuery(
		objectType: string,
		objectId: string,
		subjectContext: UserSubjectContext
	): Promise<SpiceDBResponse<EntitlementsResult>> {
		const context = subjectContext;
		const caveatContext = this.createCaveatContext(context);
		const request = this.createBulkPermissionsRequest(objectType, objectId, context, caveatContext);

		if (this.logResults) {
			await this.loggingClient?.logRequest(
				{ action: 'SpiceDB:checkBulkPermissions:request', objectType, objectId, subjectContext },
				{ request }
			);
		}

		const res = await this.client.checkBulkPermissions(request);

		if (this.logResults) {
			await this.loggingClient?.logRequest(
				{ action: 'SpiceDB:checkBulkPermissions:response', objectType, objectId },
				{ response: res }
			);
		}

		const result = this.processCheckBulkPermissionsResponse(res);

		return {
			result: { result } as EntitlementsResult
		} as SpiceDBResponse<EntitlementsResult>;
	}

	protected async executeManyCommonQuery(
		objectType: string,
		objectIds: string[],
		subjectContext: UserSubjectContext
	): Promise<SpiceDBResponse<EntitlementsBatchResult>> {
		const context = subjectContext;
		const uniqueObjectIds = Array.from(new Set(objectIds));
		if (uniqueObjectIds.length === 0) {
			return { result: {} };
		}

		const caveatContext = this.createCaveatContext(context);
		const request = this.createManyBulkPermissionsRequest(objectType, uniqueObjectIds, context, caveatContext);

		if (this.logResults) {
			await this.loggingClient?.logRequest(
				{
					action: 'SpiceDB:checkBulkPermissionsMany:request',
					objectType,
					objectIds: uniqueObjectIds,
					subjectContext
				},
				{ request }
			);
		}

		const res = await this.client.checkBulkPermissions(request);

		if (this.logResults) {
			await this.loggingClient?.logRequest(
				{ action: 'SpiceDB:checkBulkPermissionsMany:response', objectType, objectIds: uniqueObjectIds },
				{ response: res }
			);
		}

		return {
			result: this.processManyCheckBulkPermissionsResponse(res, uniqueObjectIds)
		};
	}
	protected async isPermissionLinkedToFeatures(
		requestContext: PermissionsEntitlementsContext,
		hashResourceId: boolean = true
	): Promise<boolean> {
		const lookupRequest = v1.LookupSubjectsRequest.create({
			permission: 'parent',
			resource: {
				objectType: SpiceDBEntities.Permission,
				objectId: hashResourceId ? encodeObjectId(requestContext.permissionKey) : requestContext.permissionKey
			},
			subjectObjectType: SpiceDBEntities.Feature
		});
		const lookUpRes = await this.client.lookupSubjects(lookupRequest);
		return !!lookUpRes.length;
	}

	protected hasPermission(permissionKey: string, permissions?: string[]): boolean {
		return (
			permissions?.some((permission) => {
				const escapedPermission = permission.replace(/\./g, '\\.').replace(/\*/g, '.+');
				const regex = new RegExp(`^${escapedPermission}$`);
				return regex.test(permissionKey);
			}) ?? false
		);
	}
}
