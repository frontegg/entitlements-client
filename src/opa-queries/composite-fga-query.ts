import { AxiosInstance } from 'axios';
import { EntitlementsOpaQuery } from './entitlements-opa-query';
import { EntitlementsResult, OpaResponse, RequestContext, SubjectContext } from '../types';

export const CompositeFGAOpaRoute = `/v1/data/e10s/composite/is_entitled_composite`;

export class CompositeFGAOpaQuery extends EntitlementsOpaQuery {
	constructor(pdpHost: string, axiosInstance: AxiosInstance) {
		super(pdpHost, axiosInstance);
	}

	query(subjectContext: SubjectContext, requestContext: RequestContext): Promise<OpaResponse<EntitlementsResult>> {
		return this.queryOpa(CompositeFGAOpaRoute, subjectContext, requestContext);
	}
}
