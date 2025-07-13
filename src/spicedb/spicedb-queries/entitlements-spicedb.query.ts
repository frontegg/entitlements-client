import { v1 } from '@authzed/authzed-node';
import { EntitlementsDynamicQuery, EntitlementsResult, RequestContextType, UserSubjectContext } from '../../types';
import { SpiceDBResponse } from '../../types/spicedb.dto';

export interface HashOptions {
	hashResourceId: boolean;
	hashSubjectId: boolean;
}

export abstract class EntitlementsSpiceDBQuery {
	protected client: v1.ZedPromiseClientInterface;

	protected constructor(
		protected readonly spiceDBEndpoint: string,
		protected readonly spiceDBToken: string
	) {
		const spiceClient = v1.NewClient(
			this.spiceDBToken,
			this.spiceDBEndpoint,
			v1.ClientSecurity.INSECURE_LOCALHOST_ALLOWED
		);

		this.client = spiceClient.promises;
	}

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
			'frontegg_tenant',
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
						'frontegg_user',
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
}
