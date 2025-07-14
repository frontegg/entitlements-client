import { v1 } from '@authzed/authzed-node';
import { mock, MockProxy, mockReset } from 'jest-mock-extended';
import { EntitlementsDynamicQueryRequestContext, RequestContextType } from '../../types';
import { FgaSpiceDBQuery } from './fga-spicedb.query';

describe(FgaSpiceDBQuery.name, () => {
	let queryClient: FgaSpiceDBQuery;
	let mockClient: MockProxy<v1.ZedPromiseClientInterface>;
	let mockSpiceDBEndpoint: string;
	let mockSpiceDBToken: string;

	beforeAll(() => {
		mockClient = mock<v1.ZedPromiseClientInterface>();
		mockSpiceDBEndpoint = 'mock-endpoint';
		mockSpiceDBToken = 'mock-token';

		// Create a new instance of the query class with the mock client
		queryClient = new FgaSpiceDBQuery(mockClient);
	});

	beforeEach(() => {
		mockReset(mockClient);
	});

	it('should call client.checkPermission with correct arguments', async () => {
		const requestContext: EntitlementsDynamicQueryRequestContext<RequestContextType.Entity> = {
			type: RequestContextType.Entity,
			entityType: 'document',
			key: 'doc-1',
			action: 'read'
		};
		const subjectContext = {
			entityType: 'user',
			key: 'user-1'
		};

		const mockResponse = v1.CheckPermissionResponse.create({
			permissionship: v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION
		});
		mockClient.checkPermission.mockResolvedValue(mockResponse);

		const result = await queryClient.query({
			subjectContext,
			requestContext
		});

		expect(mockClient.checkPermission).toHaveBeenCalled();
		expect(result.result.result).toBe(true);
	});

	it('should not block exceptions from client and propagate them to the user', async () => {
		const requestContext: EntitlementsDynamicQueryRequestContext<RequestContextType.Entity> = {
			type: RequestContextType.Entity,
			entityType: 'document',
			key: 'doc-1',
			action: 'read'
		};
		const subjectContext = {
			entityType: 'user',
			key: 'user-1'
		};

		const mockError = new Error('mock-error');
		mockClient.checkPermission.mockRejectedValue(mockError);

		await expect(
			queryClient.query({
				subjectContext,
				requestContext
			})
		).rejects.toThrow(mockError);
	});
});
