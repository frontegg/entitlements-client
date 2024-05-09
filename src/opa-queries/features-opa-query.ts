import {EntitlementsResult, OpaResponse, RequestContext, SubjectContext} from 'types';
import {EntitlementsOpaQuery} from './entitlements-opa-query';
import {AxiosInstance} from 'axios';

export class FeaturesOpaQuery extends EntitlementsOpaQuery {
    constructor(pdpHost: string, axiosInstance: AxiosInstance) {
        super(pdpHost, axiosInstance);
    }

    query(subjectContext: SubjectContext, requestContext: RequestContext): Promise<OpaResponse<EntitlementsResult>> {
        return this.queryOpa(`/v1/data/e10s/features/is_entitled_to_input_feature`, subjectContext, requestContext);
    }
}