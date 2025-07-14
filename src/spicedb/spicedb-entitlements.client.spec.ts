import { SpiceDBEntitlementsClient } from './spicedb-entitlements.client';
import { mock, MockProxy } from 'jest-mock-extended';
import { SpiceDBQueryClient } from './spicedb-queries/spicedb-query.client';
import { LoggingClient } from '../logging';
import { EntitlementsResult, RequestContext, RequestContextType, SubjectContext } from '../types';
import { SpiceDBResponse } from '../types/spicedb.dto';
import { ClientConfiguration, FallbackConfiguration } from '../client-configuration';
import { v1 } from '@authzed/authzed-node';

// Helper function to create request contexts for each type
function getRequestContext(type: RequestContextType): RequestContext {
	switch (type) {
		case RequestContextType.Feature:
			return {
				type: RequestContextType.Feature,
				featureKey: 'mock-feature'
			};
		case RequestContextType.Permission:
			return {
				type: RequestContextType.Permission,
				permissionKey: 'mock-permission-key'
			};
		case RequestContextType.Route:
			return {
				type: RequestContextType.Route,
				method: 'mock-method',
				path: 'mock-path'
			};
		case RequestContextType.Entity:
			return {
				type: RequestContextType.Entity,
				entityType: 'document',
				key: 'document-1',
				action: 'read'
			};
		default:
			throw new Error(`Unknown request context type: ${type}`);
	}
}

describe(SpiceDBEntitlementsClient.name, () => {
	describe.each(Object.values(RequestContextType))(
		'Given successful SpiceDB query for `%s` request context type',
		(requestContextType) => {
			// GIVEN
			const mockSpiceClient: MockProxy<v1.ZedPromiseClientInterface> = mock<v1.ZedPromiseClientInterface>();
			const mockLoggingClient: MockProxy<LoggingClient> = mock<LoggingClient>();
			const mockSpiceDBQueryClient: MockProxy<SpiceDBQueryClient> = mock<SpiceDBQueryClient>();
			const spiceDBResult: SpiceDBResponse<EntitlementsResult> = {
				result: { result: true }
			};

			// Mock the spiceDBQuery method to return a successful response
			mockSpiceDBQueryClient.spiceDBQuery.mockResolvedValue(spiceDBResult);

			const mockClientConfig: ClientConfiguration = {
				spiceDBEndpoint: 'mock-endpoint',
				spiceDBToken: 'mock-token'
			};

			const subjectContext: SubjectContext = {
				userId: 'mock-user-id',
				tenantId: 'mock-tenant-id',
				permissions: ['mock-permission'],
				attributes: { mockAttribute: 'mock-value' }
			};

			const requestContext = getRequestContext(requestContextType);

			it('should not log results if logResults flag is turned off', async () => {
				// WHEN logging: false
				const cut = new SpiceDBEntitlementsClient(mockClientConfig, mockLoggingClient, false);
				// Replace the internal spiceDBQueryClient with our mock
				(cut as any).spiceDBQueryClient = mockSpiceDBQueryClient;

				const result = await cut.isEntitledTo(subjectContext, requestContext);

				// THEN
				expect(mockSpiceDBQueryClient.spiceDBQuery).toHaveBeenCalledWith(subjectContext, requestContext);
				expect(result).toEqual({ result: true });
				expect(mockLoggingClient.log).not.toHaveBeenCalled();
			});

			it('should log results if logResults flag is turned on', async () => {
				// WHEN logging: true
				const cut = new SpiceDBEntitlementsClient(mockClientConfig, mockLoggingClient, true);
				// Replace the internal spiceDBQueryClient with our mock
				(cut as any).spiceDBQueryClient = mockSpiceDBQueryClient;

				const result = await cut.isEntitledTo(subjectContext, requestContext);

				// THEN
				expect(mockSpiceDBQueryClient.spiceDBQuery).toHaveBeenCalledWith(subjectContext, requestContext);
				expect(result).toEqual({ result: true });
				expect(mockLoggingClient.log).toHaveBeenCalledWith(subjectContext, requestContext, spiceDBResult);
			});

			it('should return the correct result from SpiceDB response', async () => {
				// Mock a different response for this test
				const differentResult: SpiceDBResponse<EntitlementsResult> = {
					result: { result: false }
				};
				mockSpiceDBQueryClient.spiceDBQuery.mockResolvedValueOnce(differentResult);

				const cut = new SpiceDBEntitlementsClient(mockClientConfig, mockLoggingClient, false);
				// Replace the internal spiceDBQueryClient with our mock
				(cut as any).spiceDBQueryClient = mockSpiceDBQueryClient;

				const result = await cut.isEntitledTo(subjectContext, requestContext);

				expect(mockSpiceDBQueryClient.spiceDBQuery).toHaveBeenCalledWith(subjectContext, requestContext);
				expect(result).toEqual({ result: false });
			});
		}
	);

	describe.each(Object.values(RequestContextType))(
		'Given SpiceDB query throws error for `%s` request context type',
		(requestContextType) => {
			// GIVEN
			const mockSpiceDBQueryClient: MockProxy<SpiceDBQueryClient> = mock<SpiceDBQueryClient>();
			const mockLoggingClient: MockProxy<LoggingClient> = mock<LoggingClient>();
			const error = new Error('SpiceDB connection failed');
			mockSpiceDBQueryClient.spiceDBQuery.mockRejectedValue(error);

			const mockClientConfig: ClientConfiguration = {
				spiceDBEndpoint: 'mock-endpoint',
				spiceDBToken: 'mock-token'
			};

			const subjectContext: SubjectContext = {
				userId: 'mock-user-id',
				tenantId: 'mock-tenant-id',
				permissions: ['mock-permission'],
				attributes: { mockAttribute: 'mock-value' }
			};

			const requestContext = getRequestContext(requestContextType);

			it('should log error and return default fallback of false', async () => {
				const cut = new SpiceDBEntitlementsClient(mockClientConfig, mockLoggingClient, false);
				// Replace the internal spiceDBQueryClient with our mock
				(cut as any).spiceDBQueryClient = mockSpiceDBQueryClient;

				const result = await cut.isEntitledTo(subjectContext, requestContext);

				expect(mockSpiceDBQueryClient.spiceDBQuery).toHaveBeenCalledWith(subjectContext, requestContext);
				expect(mockLoggingClient.error).toHaveBeenCalledWith(error);
				expect(result).toEqual({ result: false });
			});

			it('should log error and return configured fallback of true', async () => {
				const cut = new SpiceDBEntitlementsClient(
					mockClientConfig,
					mockLoggingClient,
					false,
					{
						defaultFallback: true
					}
				);
				// Replace the internal spiceDBQueryClient with our mock
				(cut as any).spiceDBQueryClient = mockSpiceDBQueryClient;

				const result = await cut.isEntitledTo(subjectContext, requestContext);

				expect(mockSpiceDBQueryClient.spiceDBQuery).toHaveBeenCalledWith(subjectContext, requestContext);
				expect(mockLoggingClient.error).toHaveBeenCalledWith(error);
				expect(result).toEqual({ result: true });
			});
		}
	);

	describe.each<[RequestContext, EntitlementsResult]>([
		[
			{
				type: RequestContextType.Feature,
				featureKey: 'test-feature'
			},
			{ result: true }
		],
		[
			{
				type: RequestContextType.Feature,
				featureKey: 'other-feature'
			},
			{ result: false }
		],
		[
			{
				type: RequestContextType.Permission,
				permissionKey: 'test.permission'
			},
			{ result: true }
		],
		[
			{
				type: RequestContextType.Permission,
				permissionKey: 'other.permission'
			},
			{ result: false }
		],
		[
			{
				type: RequestContextType.Route,
				method: 'GET',
				path: '/users'
			},
			{ result: true }
		],
		[
			{
				type: RequestContextType.Route,
				method: 'POST',
				path: '/users'
			},
			{ result: false }
		],
		[
			{
				type: RequestContextType.Entity,
				entityType: 'document',
				key: 'doc-1',
				action: 'read'
			},
			{ result: true }
		],
		[
			{
				type: RequestContextType.Entity,
				entityType: 'document',
				key: 'doc-2',
				action: 'write'
			},
			{ result: false }
		]
	])('Given static fallback configurations', (requestContext, expectedResult) => {
		const mockSpiceDBQueryClient: MockProxy<SpiceDBQueryClient> = mock<SpiceDBQueryClient>();
		const mockLoggingClient: MockProxy<LoggingClient> = mock<LoggingClient>();
		const error = new Error('SpiceDB Error');
		mockSpiceDBQueryClient.spiceDBQuery.mockRejectedValue(error);

		const mockClientConfig: ClientConfiguration = {
			spiceDBEndpoint: 'mock-endpoint',
			spiceDBToken: 'mock-token'
		};

		const fallbackConfiguration: FallbackConfiguration = {
			defaultFallback: false,
			feature: { 'test-feature': true },
			permission: { 'test.permission': true },
			route: { 'GET_/users': true },
			entity: { 'document:doc-1@read': true }
		};

		const subjectContext: SubjectContext = {
			userId: 'mock-user-id',
			tenantId: 'mock-tenant-id',
			permissions: ['mock-permission'],
			attributes: { mockAttribute: 'mock-value' }
		};

		it('should pick specific fallback if configured, otherwise fallback to default', async () => {
			const cut = new SpiceDBEntitlementsClient(
				mockClientConfig,
				mockLoggingClient,
				false,
				fallbackConfiguration
			);
			// Replace the internal spiceDBQueryClient with our mock
			(cut as any).spiceDBQueryClient = mockSpiceDBQueryClient;

			const result = await cut.isEntitledTo(subjectContext, requestContext);

			expect(mockSpiceDBQueryClient.spiceDBQuery).toHaveBeenCalledWith(subjectContext, requestContext);
			expect(mockLoggingClient.error).toHaveBeenCalledWith(error);
			expect(result).toEqual(expectedResult);
		});
	});

	describe.each<[RequestContext, EntitlementsResult]>([
		[
			{
				type: RequestContextType.Feature,
				featureKey: 'test-feature'
			},
			{ result: false }
		],
		[
			{
				type: RequestContextType.Permission,
				permissionKey: 'test.permission'
			},
			{ result: true }
		],
		[
			{
				type: RequestContextType.Route,
				method: 'GET',
				path: '/admin'
			},
			{ result: true }
		],
		[
			{
				type: RequestContextType.Entity,
				entityType: 'document',
				key: 'doc-1',
				action: 'read'
			},
			{ result: false }
		]
	])('Given async function fallback configurations', (requestContext, expectedResult) => {
		const mockSpiceDBQueryClient: MockProxy<SpiceDBQueryClient> = mock<SpiceDBQueryClient>();
		const mockLoggingClient: MockProxy<LoggingClient> = mock<LoggingClient>();
		const error = new Error('SpiceDB Error');
		mockSpiceDBQueryClient.spiceDBQuery.mockRejectedValue(error);

		const mockClientConfig: ClientConfiguration = {
			spiceDBEndpoint: 'mock-endpoint',
			spiceDBToken: 'mock-token'
		};

		const fallbackConfiguration: FallbackConfiguration = async (requestContext: RequestContext) => {
			if (requestContext.type === RequestContextType.Feature) {
				return false;
			} else if (requestContext.type === RequestContextType.Permission) {
				return true;
			} else if (requestContext.type === RequestContextType.Route) {
				return true;
			} else {
				return false;
			}
		};

		const subjectContext: SubjectContext = {
			userId: 'mock-user-id',
			tenantId: 'mock-tenant-id',
			permissions: ['mock-permission'],
			attributes: { mockAttribute: 'mock-value' }
		};

		it('should call function fallback with given request-context', async () => {
			const cut = new SpiceDBEntitlementsClient(
				mockClientConfig,
				mockLoggingClient,
				false,
				fallbackConfiguration
			);
			// Replace the internal spiceDBQueryClient with our mock
			(cut as any).spiceDBQueryClient = mockSpiceDBQueryClient;

			const result = await cut.isEntitledTo(subjectContext, requestContext);

			expect(mockSpiceDBQueryClient.spiceDBQuery).toHaveBeenCalledWith(subjectContext, requestContext);
			expect(mockLoggingClient.error).toHaveBeenCalledWith(error);
			expect(result).toEqual(expectedResult);
		});
	});

	describe('Constructor parameter validation', () => {
		const mockLoggingClient: MockProxy<LoggingClient> = mock<LoggingClient>();
		const mockClientConfig: ClientConfiguration = {
			spiceDBEndpoint: 'mock-endpoint',
			spiceDBToken: 'mock-token'
		};

		it('should create instance with minimal parameters', () => {
			const cut = new SpiceDBEntitlementsClient(mockClientConfig, mockLoggingClient, false);
			expect(cut).toBeInstanceOf(SpiceDBEntitlementsClient);
		});

		it('should create instance with all parameters', () => {
			const fallbackConfig: FallbackConfiguration = { defaultFallback: true };
			const cut = new SpiceDBEntitlementsClient(
				mockClientConfig,
				mockLoggingClient,
				true,
				fallbackConfig
			);
			expect(cut).toBeInstanceOf(SpiceDBEntitlementsClient);
		});
	});

	describe('Edge cases and error scenarios', () => {
		const mockSpiceDBQueryClient: MockProxy<SpiceDBQueryClient> = mock<SpiceDBQueryClient>();
		const mockLoggingClient: MockProxy<LoggingClient> = mock<LoggingClient>();
		const mockClientConfig: ClientConfiguration = {
			spiceDBEndpoint: 'mock-endpoint',
			spiceDBToken: 'mock-token'
		};

		it('should handle undefined result gracefully', async () => {
			// Mock a response with empty result
			const emptyResult: SpiceDBResponse<EntitlementsResult> = {
				result: { result: false }
			};
			mockSpiceDBQueryClient.spiceDBQuery.mockResolvedValue(emptyResult);

			const cut = new SpiceDBEntitlementsClient(mockClientConfig, mockLoggingClient, false);
			// Replace the internal spiceDBQueryClient with our mock
			(cut as any).spiceDBQueryClient = mockSpiceDBQueryClient;

			const result = await cut.isEntitledTo(
				{ userId: 'test', tenantId: 'test', permissions: [], attributes: {} },
				{ type: RequestContextType.Feature, featureKey: 'test' }
			);

			expect(mockSpiceDBQueryClient.spiceDBQuery).toHaveBeenCalled();
			expect(result).toEqual({ result: false });
		});

		it('should propagate logging errors and return fallback result', async () => {
			// Mock a successful response
			const successResult: SpiceDBResponse<EntitlementsResult> = {
				result: { result: true }
			};
			mockSpiceDBQueryClient.spiceDBQuery.mockResolvedValue(successResult);

			mockLoggingClient.log.mockRejectedValue(new Error('Logging failed'));

			const cut = new SpiceDBEntitlementsClient(mockClientConfig, mockLoggingClient, true);
			// Replace the internal spiceDBQueryClient with our mock
			(cut as any).spiceDBQueryClient = mockSpiceDBQueryClient;

			const result = await cut.isEntitledTo(
				{ userId: 'test', tenantId: 'test', permissions: [], attributes: {} },
				{ type: RequestContextType.Feature, featureKey: 'test' }
			);

			// If logging fails, it goes to the error path and returns fallback result
			expect(mockSpiceDBQueryClient.spiceDBQuery).toHaveBeenCalled();
			expect(mockLoggingClient.error).toHaveBeenCalledWith(new Error('Logging failed'));
			expect(result).toEqual({ result: false });
		});

		it('should propagate error logging failures', async () => {
			const error = new Error('SpiceDB Error');
			mockSpiceDBQueryClient.spiceDBQuery.mockRejectedValue(error);
			mockLoggingClient.error.mockRejectedValue(new Error('Error logging failed'));

			const cut = new SpiceDBEntitlementsClient(mockClientConfig, mockLoggingClient, false);
			// Replace the internal spiceDBQueryClient with our mock
			(cut as any).spiceDBQueryClient = mockSpiceDBQueryClient;

			// If error logging fails, the entire operation should fail
			await expect(
				cut.isEntitledTo(
					{ userId: 'test', tenantId: 'test', permissions: [], attributes: {} },
					{ type: RequestContextType.Feature, featureKey: 'test' }
				)
			).rejects.toThrow('Error logging failed');
		});
	});
});
