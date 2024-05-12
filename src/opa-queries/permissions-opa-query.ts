import {EntitlementsResult, OpaResponse, RequestContext, SubjectContext} from '../types';
import {EntitlementsOpaQuery} from './entitlements-opa-query';
import {AxiosInstance} from 'axios';

export const PermissionsOpaRoute = `/v1/data/e10s/permissions/is_entitled_to_input_permission`;

export class PermissionsOpaQuery extends EntitlementsOpaQuery {
	constructor(pdpHost: string, axiosInstance: AxiosInstance) {
		super(pdpHost, axiosInstance);
	}

	query(subjectContext: SubjectContext, requestContext: RequestContext): Promise<OpaResponse<EntitlementsResult>> {
		return this.queryOpa(PermissionsOpaRoute, subjectContext, requestContext);
	}
}
