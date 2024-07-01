import { EntitlementsOpaQuery } from './entitlements-opa-query';
import { EntitlementsResult, OpaResponse, RequestContext, RequestContextType, SubjectContext } from '../types';
import { FeaturesOpaQuery } from './features-opa-query';
import { AxiosInstance } from 'axios';
import { PermissionsOpaQuery } from './permissions-opa-query';
import { RoutesOpaQuery } from './routes-opa-query';
import { ManyOpaQuery } from './many-opa-query';

export class OpaQueryClient extends EntitlementsOpaQuery {
	private readonly strategy: Record<RequestContextType, EntitlementsOpaQuery>;
	private readonly manyStrategy: EntitlementsOpaQuery;
	constructor(pdpHost: string, axiosInstance: AxiosInstance) {
		super(pdpHost, axiosInstance);
		this.strategy = {
			[RequestContextType.Feature]: new FeaturesOpaQuery(pdpHost, axiosInstance),
			[RequestContextType.Permission]: new PermissionsOpaQuery(pdpHost, axiosInstance),
			[RequestContextType.Route]: new RoutesOpaQuery(pdpHost, axiosInstance)
		};
		this.manyStrategy = new ManyOpaQuery(pdpHost, axiosInstance);
	}

	query(
		subjectContext: SubjectContext,
		requestContext: RequestContext | RequestContext[]
	): Promise<OpaResponse<EntitlementsResult>> {
		if (!Array.isArray(requestContext)) {
			return this.strategy[requestContext.type].query(subjectContext, requestContext);
		} else {
			return this.manyStrategy.query(subjectContext, requestContext);
		}
	}
}
