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

	it('should pass active_at caveat context with default "at" (now) when not provided', async () => {
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

		await queryClient.query({ subjectContext, requestContext });

		const call = mockClient.checkPermission.mock.calls[0][0];
		expect(call.context).toBeDefined();
		expect(call.context?.fields?.at?.kind?.oneofKind).toBe('stringValue');
		// Verify it's a valid ISO timestamp (approximately now)
		const atValue = (call.context?.fields?.at?.kind as any)?.stringValue;
		expect(atValue).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
	});

	it('should pass active_at caveat context with provided "at" timestamp', async () => {
		const customAt = '2026-01-15T12:00:00.000Z';
		const requestContext: EntitlementsDynamicQueryRequestContext<RequestContextType.Entity> = {
			type: RequestContextType.Entity,
			entityType: 'document',
			key: 'doc-1',
			action: 'read',
			at: customAt
		};
		const subjectContext = {
			entityType: 'user',
			key: 'user-1'
		};

		const mockResponse = v1.CheckPermissionResponse.create({
			permissionship: v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION
		});
		mockClient.checkPermission.mockResolvedValue(mockResponse);

		await queryClient.query({ subjectContext, requestContext });

		const call = mockClient.checkPermission.mock.calls[0][0];
		expect(call.context?.fields?.at?.kind).toEqual({
			oneofKind: 'stringValue',
			stringValue: customAt
		});
	});

	it('should pass active_at caveat context with timezone offset format', async () => {
		const customAt = '2025-12-31T23:59:59+02:00';
		const requestContext: EntitlementsDynamicQueryRequestContext<RequestContextType.Entity> = {
			type: RequestContextType.Entity,
			entityType: 'document',
			key: 'doc-1',
			action: 'read',
			at: customAt
		};
		const subjectContext = {
			entityType: 'user',
			key: 'user-1'
		};

		const mockResponse = v1.CheckPermissionResponse.create({
			permissionship: v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION
		});
		mockClient.checkPermission.mockResolvedValue(mockResponse);

		await queryClient.query({ subjectContext, requestContext });

		const call = mockClient.checkPermission.mock.calls[0][0];
		expect(call.context?.fields?.at?.kind).toEqual({
			oneofKind: 'stringValue',
			stringValue: customAt
		});
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
