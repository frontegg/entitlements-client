import { AxiosInstance } from 'axios';
import { EntitlementsOpaQuery } from './entitlements-opa-query';
import { SubjectContext, RequestContext, OpaResponse, EntitlementsResult } from '../types';

export const ManyOpaRoute = `/v1/data/e10s/many/is_entitled_to`;

export class ManyOpaQuery extends EntitlementsOpaQuery {
	constructor(pdpHost: string, axiosInstance: AxiosInstance) {
		super(pdpHost, axiosInstance);
	}

	query(subjectContext: SubjectContext, requestContext: RequestContext[]): Promise<OpaResponse<EntitlementsResult>> {
		return this.queryOpa(ManyOpaRoute, subjectContext, requestContext);
	}
}
