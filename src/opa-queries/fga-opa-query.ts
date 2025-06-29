import { AxiosInstance } from 'axios';
import { EntitlementsOpaQuery } from './entitlements-opa-query';
import { EntitlementsResult, OpaResponse, RequestContext, SubjectContext } from '../types';

export const FGAOpaRoute = `/v1/data/e10s/fga/is_entitled_to_target`;

export class FGAOpaQuery extends EntitlementsOpaQuery {
	constructor(pdpHost: string, axiosInstance: AxiosInstance) {
		super(pdpHost, axiosInstance);
	}

	query(subjectContext: SubjectContext, requestContext: RequestContext): Promise<OpaResponse<EntitlementsResult>> {
		return this.queryOpa(FGAOpaRoute, subjectContext, requestContext);
	}
}
