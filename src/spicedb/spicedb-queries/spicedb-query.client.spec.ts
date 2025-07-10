import { SpiceDBQueryClient } from './spicedb-query.client';
import { mock, MockProxy, mockReset } from 'jest-mock-extended';
import { v1 } from '@authzed/authzed-node';
import { RequestContext, RequestContextType, SubjectContext } from '../../types';
import { getRequestContext } from './entitlements-spicedb.query.spec-helper';

describe(SpiceDBQueryClient.name, () => {
	let queryClient: SpiceDBQueryClient;
	let mockSpiceDBEndpoint: string;
	let mockSpiceDBToken: string;

	beforeAll(() => {
		mockSpiceDBEndpoint = 'mock-endpoint';
		mockSpiceDBToken = 'mock-token';

		queryClient = new SpiceDBQueryClient(mockSpiceDBEndpoint, mockSpiceDBToken);
	});

	it.each([
		{ requestContextType: RequestContextType.Feature },
		{ requestContextType: RequestContextType.Permission },
		{ requestContextType: RequestContextType.Route },
		{ requestContextType: RequestContextType.Entity }
	])('should delegate to the correct strategy for %p', async ({ requestContextType }) => {
		const subjectContext: SubjectContext = {
			userId: 'mock-user-id',
			tenantId: 'mock-tenant-id',
			permissions: ['mock-permission'],
			attributes: { mockAttribute: 'mock-value' }
		};
		// Don't care about actual request context, just need to pass it to the query method
		const requestContext: RequestContext = getRequestContext(requestContextType);
		
		// Mock the strategy's query method
		const mockStrategy = jest.spyOn(queryClient['strategy'][requestContextType], 'query');
		mockStrategy.mockResolvedValue({ result: { result: true } });

		await queryClient.spiceDBQuery(subjectContext, requestContext);
		
		expect(mockStrategy).toHaveBeenCalledWith({ requestContext, subjectContext });
	});
});