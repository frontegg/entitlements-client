import { EntitlementsOpaQuery } from './entitlements-opa-query';
import { EntitlementsResult, OpaResponse, RequestContext, SubjectContext } from '../types';
import { AxiosInstance } from 'axios';

export const RoutesOpaRoute = `/v1/data/e10s/routes/is_entitled_to_input_route`;

export class RoutesOpaQuery extends EntitlementsOpaQuery {
	constructor(pdpHost: string, axiosInstance: AxiosInstance) {
		super(pdpHost, axiosInstance);
	}

	query(subjectContext: SubjectContext, requestContext: RequestContext): Promise<OpaResponse<EntitlementsResult>> {
		return this.queryOpa(RoutesOpaRoute, subjectContext, requestContext);
	}
}
