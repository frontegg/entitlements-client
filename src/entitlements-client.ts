import {
    EntitlementsQuery,
    EntitlementsQueryRequestContext,
    EntitlementsResult,
    FeatureEntitlementsContext,
    OpaRequest,
    OpaResponse,
    PermissionsEntitlementsContext,
    RequestContext,
    RequestContextType,
    RouteEntitlementsContext,
    SubjectContext
} from './types';
import {ClientConfiguration} from './client-configuration';
import axios, {AxiosInstance, AxiosResponse} from 'axios';

type OpaQueryFunction<RC extends RequestContext = any> = (subjectContext: SubjectContext, requestContext: RC) => Promise<EntitlementsResult>;

export class EntitlementsClient {
    private readonly strategy: Record<RequestContextType, OpaQueryFunction>;
    private readonly httpClient: AxiosInstance;

    constructor(private readonly configuration: ClientConfiguration, axiosRef: AxiosInstance) {
        this.httpClient = axiosRef ?? axios.create({baseURL: configuration.pdpHost});

        this.strategy = {
            [RequestContextType.Feature]: this.queryFeature.bind(this),
            [RequestContextType.Permission]: this.queryPermissions.bind(this),
            [RequestContextType.Route]: this.queryRoute.bind(this)
        };
    }

    public async isEntitledTo(subjectContext: SubjectContext, requestContext: RequestContext): Promise<EntitlementsResult> {
        return this.strategy[requestContext.type](subjectContext, requestContext);
    }

    private async queryFeature(subjectContext: SubjectContext, requestContext: FeatureEntitlementsContext): Promise<EntitlementsResult> {
        return this.queryOpa(`/v1/data/e10s/features/is_entitled_to_input_feature`, subjectContext, requestContext);
    }

    private async queryPermissions(subjectContext: SubjectContext, requestContext: PermissionsEntitlementsContext): Promise<EntitlementsResult> {
        return this.queryOpa(`/v1/data/e10s/permissions/is_entitled_to_input_permission`, subjectContext, requestContext);
    }

    private async queryRoute(subjectContext: SubjectContext, requestContext: RouteEntitlementsContext): Promise<EntitlementsResult> {
        return this.queryOpa(`/v1/data/e10s/routes/is_authorized_to_input_route`, subjectContext, requestContext);
    }

    private async queryOpa(route: string, subjectContext: SubjectContext, requestContext: RequestContext): Promise<EntitlementsResult> {
        const {type: _, ...context} = requestContext;
        const res = await this.httpClient
                .post<OpaResponse<EntitlementsResult>, AxiosResponse<OpaResponse<EntitlementsResult>>, OpaRequest<EntitlementsQuery>>(
                        route,
                        this.constructOpaPayload(subjectContext, context),
                        {baseURL: this.configuration.pdpHost}
                );

        return this.constructResult(res.data);
    }

    private constructOpaPayload(subjectContext: SubjectContext, requestContext: EntitlementsQueryRequestContext): OpaRequest<EntitlementsQuery> {
        return {
            input: {
                subjectContext: {
                    userId: subjectContext.userId,
                    tenantId: subjectContext.tenantId,
                    permissions: subjectContext.permissions,
                    attributes: subjectContext.attributes
                },
                requestContext
            }
        };
    }

    private constructResult(data: OpaResponse<EntitlementsResult>): EntitlementsResult {

        return data?.result; // TODO ? new Authorized(data?.rules) : new NotAuthorized(data?.rules);
    }
}
