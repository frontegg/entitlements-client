import {
	EntitlementsQuery,
	EntitlementsQueryRequestContext,
	EntitlementsResult,
	OpaRequest,
	OpaResponse,
	RequestContext,
	SubjectContext
} from '../types';
import { AxiosInstance, AxiosResponse } from 'axios';

export abstract class EntitlementsOpaQuery {
	protected constructor(
		private readonly pdpHost: string,
		private readonly httpClient: AxiosInstance
	) {}

	abstract query(
		subjectContext: SubjectContext,
		requestContext: RequestContext
	): Promise<OpaResponse<EntitlementsResult>>;

	protected async queryOpa(
		route: string,
		subjectContext: SubjectContext,
		requestContext: RequestContext
	): Promise<OpaResponse<EntitlementsResult>> {
		// TODO should we validate subjectContext and requestContext? if so, add tests
		const { type: _, ...context } = requestContext;
		const opaQuery = this.constructOpaPayload(subjectContext, context);
		const res = await this.httpClient.post<
			OpaResponse<EntitlementsResult>,
			AxiosResponse<OpaResponse<EntitlementsResult>>,
			OpaRequest<EntitlementsQuery>
		>(route, opaQuery, { baseURL: this.pdpHost });

		return res.data;
	}

	protected constructOpaPayload(
		subjectContext: SubjectContext,
		requestContext: EntitlementsQueryRequestContext
	): OpaRequest<EntitlementsQuery> {
		return {
			input: {
				subjectContext: {
					userId: subjectContext.userId || null,
					tenantId: subjectContext.tenantId,
					permissions: subjectContext.permissions || [],
					attributes: subjectContext.attributes || {}
				},
				requestContext
			}
		};
	}
}
