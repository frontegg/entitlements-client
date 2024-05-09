import {
    EntitlementsQuery,
    EntitlementsQueryRequestContext,
    EntitlementsResult,
    OpaRequest,
    OpaResponse,
    RequestContext,
    SubjectContext
} from '../types';
import {AxiosInstance, AxiosResponse} from 'axios';

export abstract class EntitlementsOpaQuery {
    protected constructor(private readonly pdpHost: string, private readonly httpClient: AxiosInstance) {
    }

    abstract query(subjectContext: SubjectContext, requestContext: RequestContext): Promise<OpaResponse<EntitlementsResult>>;

    protected async queryOpa(route: string, subjectContext: SubjectContext, requestContext: RequestContext): Promise<OpaResponse<EntitlementsResult>> {
        const {type: _, ...context} = requestContext;
        const res = await this.httpClient
                .post<OpaResponse<EntitlementsResult>, AxiosResponse<OpaResponse<EntitlementsResult>>, OpaRequest<EntitlementsQuery>>(
                        route,
                        this.constructOpaPayload(subjectContext, context),
                        {baseURL: this.pdpHost}
                );

        return res.data;
    }

    protected constructOpaPayload(subjectContext: SubjectContext, requestContext: EntitlementsQueryRequestContext): OpaRequest<EntitlementsQuery> {
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
}