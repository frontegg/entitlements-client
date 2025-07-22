import { v1 } from '@authzed/authzed-node';
import {
	EntitlementsDynamicQuery,
	EntitlementsResult,
	PermissionsEntitlementsContext,
	RequestContextType,
	UserSubjectContext
} from '../../types';
import { SpiceDBResponse } from '../../types/spicedb.dto';
import { SpiceDBEntities } from '../../types/spicedb-consts';

export interface HashOptions {
	hashResourceId: boolean;
	hashSubjectId: boolean;
}

export abstract class EntitlementsSpiceDBQuery {
	protected constructor(protected readonly client: v1.ZedPromiseClientInterface) {}

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
				objectId: hashOptions.hashResourceId ? this.normalizeObjectId(resourceObjectId) : resourceObjectId
			},
			permission: 'access',
			subject: {
				object: {
					objectType: subjectObjectType,
					objectId: hashOptions.hashSubjectId ? this.normalizeObjectId(subjectObjectId) : subjectObjectId
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

	protected processCheckBulkPermissionsResponse(res: v1.CheckBulkPermissionsResponse): boolean {
		return res.pairs.some(
			(pair) =>
				pair.response.oneofKind === 'item' &&
				pair.response.item.permissionship === v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION
		);
	}

	protected async executeCommonQuery(
		objectType: string,
		objectId: string,
		subjectContext: UserSubjectContext
	): Promise<SpiceDBResponse<EntitlementsResult>> {
		const context = subjectContext;
		const caveatContext = this.createCaveatContext(context);
		const request = this.createBulkPermissionsRequest(objectType, objectId, context, caveatContext);
		const res = await this.client.checkBulkPermissions(request);
		const result = this.processCheckBulkPermissionsResponse(res);

		return {
			result: { result } as EntitlementsResult
		} as SpiceDBResponse<EntitlementsResult>;
	}

	protected normalizeObjectId(objectId: string): string {
		return Buffer.from(objectId).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
	}

	protected async isPermissionLinkedToFeatures(
		requestContext: PermissionsEntitlementsContext,
		hashResourceId: boolean = true
	): Promise<boolean> {
		const lookupRequest = v1.LookupSubjectsRequest.create({
			permission: 'parent',
			resource: {
				objectType: SpiceDBEntities.Permission,
				objectId: hashResourceId
					? this.normalizeObjectId(requestContext.permissionKey)
					: requestContext.permissionKey
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
