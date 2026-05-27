import { SpiceDBEntitlementsClient } from './spicedb-entitlements.client';
import { mock, MockProxy } from 'jest-mock-extended';
import { SpiceDBQueryClient } from './spicedb-queries/spicedb-query.client';
import { LoggingClient } from '../logging';
import {
	EntitlementsBatchResult,
	EntitlementsResult,
	FGASubjectContext,
	RequestContext,
	RequestContextType,
	SubjectContext,
	UserSubjectContext
} from '../types';
import { SpiceDBResponse } from '../types/spicedb.dto';
import { ClientConfiguration, FallbackConfiguration } from '../client-configuration';

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

function setSpiceDBQueryClient(client: SpiceDBEntitlementsClient, spiceDBQueryClient: SpiceDBQueryClient): void {
	(client as unknown as { spiceDBQueryClient: SpiceDBQueryClient }).spiceDBQueryClient = spiceDBQueryClient;
}

describe(SpiceDBEntitlementsClient.name, () => {
	describe.each(Object.values(RequestContextType))(
		'Given successful SpiceDB query for `%s` request context type',
		(requestContextType) => {
			// GIVEN
			const mockLoggingClient: MockProxy<LoggingClient> = mock<LoggingClient>();
			const mockSpiceDBQueryClient: MockProxy<SpiceDBQueryClient> = mock<SpiceDBQueryClient>();
			const spiceDBResult: SpiceDBResponse<EntitlementsResult> = {
				result: { result: true }
			};

			// Mock the spiceDBQuery method to return a successful response
			mockSpiceDBQueryClient.spiceDBQuery.mockResolvedValue(spiceDBResult);

			const mockClientConfig: ClientConfiguration = {
				engineEndpoint: 'mock-endpoint',
				engineToken: 'mock-token'
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
				setSpiceDBQueryClient(cut, mockSpiceDBQueryClient);

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
				setSpiceDBQueryClient(cut, mockSpiceDBQueryClient);

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
				setSpiceDBQueryClient(cut, mockSpiceDBQueryClient);

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
				engineEndpoint: 'mock-endpoint',
				engineToken: 'mock-token'
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
				setSpiceDBQueryClient(cut, mockSpiceDBQueryClient);

				const result = await cut.isEntitledTo(subjectContext, requestContext);

				expect(mockSpiceDBQueryClient.spiceDBQuery).toHaveBeenCalledWith(subjectContext, requestContext);
				expect(mockLoggingClient.error).toHaveBeenCalledWith(error);
				expect(result).toEqual({ result: false });
			});

			it('should log error and return configured fallback of true', async () => {
				const cut = new SpiceDBEntitlementsClient(mockClientConfig, mockLoggingClient, false, {
					defaultFallback: true
				});
				// Replace the internal spiceDBQueryClient with our mock
				setSpiceDBQueryClient(cut, mockSpiceDBQueryClient);

				const result = await cut.isEntitledTo(subjectContext, requestContext);

				expect(mockSpiceDBQueryClient.spiceDBQuery).toHaveBeenCalledWith(subjectContext, requestContext);
				expect(mockLoggingClient.error).toHaveBeenCalledWith(error);
				expect(result).toEqual({ result: true });
			});
		}
	);

	describe(SpiceDBEntitlementsClient.prototype.isEntitledToMany.name, () => {
		const mockClientConfig: ClientConfiguration = {
			engineEndpoint: 'mock-endpoint',
			engineToken: 'mock-token'
		};

		const subjectContext: UserSubjectContext = {
			userId: 'mock-user-id',
			tenantId: 'mock-tenant-id',
			permissions: ['mock-permission'],
			attributes: { mockAttribute: 'mock-value' }
		};

		it('should return entitlement results in request order for every request context type', async () => {
			const mockSpiceDBQueryClient: MockProxy<SpiceDBQueryClient> = mock<SpiceDBQueryClient>();
			const mockLoggingClient: MockProxy<LoggingClient> = mock<LoggingClient>();
			const spiceDBResult: SpiceDBResponse<EntitlementsBatchResult> = {
				result: {
					'feature-a': { result: true },
					'feature-b': { result: false }
				}
			};
			mockSpiceDBQueryClient.spiceDBBatchFeatureQuery.mockResolvedValue(spiceDBResult);
			mockSpiceDBQueryClient.spiceDBQuery
				.mockResolvedValueOnce({ result: { result: true } })
				.mockResolvedValueOnce({ result: { result: false } })
				.mockResolvedValueOnce({ result: { result: true } });

			const permissionContext: RequestContext = {
				type: RequestContextType.Permission,
				permissionKey: 'permission-a'
			};
			const routeContext: RequestContext = {
				type: RequestContextType.Route,
				method: 'GET',
				path: '/users'
			};
			const entityContext: RequestContext = {
				type: RequestContextType.Entity,
				entityType: 'document',
				key: 'document-1',
				action: 'read'
			};

			const cut = new SpiceDBEntitlementsClient(mockClientConfig, mockLoggingClient, false);
			setSpiceDBQueryClient(cut, mockSpiceDBQueryClient);

			const result = await cut.isEntitledToMany(subjectContext, [
				{ type: RequestContextType.Feature, featureKey: 'feature-a' },
				permissionContext,
				{ type: RequestContextType.Feature, featureKey: 'feature-b' },
				routeContext,
				entityContext
			]);

			expect(mockSpiceDBQueryClient.spiceDBBatchFeatureQuery).toHaveBeenCalledWith(subjectContext, [
				'feature-a',
				'feature-b'
			]);
			expect(mockSpiceDBQueryClient.spiceDBQuery).toHaveBeenCalledWith(subjectContext, permissionContext);
			expect(mockSpiceDBQueryClient.spiceDBQuery).toHaveBeenCalledWith(subjectContext, routeContext);
			expect(mockSpiceDBQueryClient.spiceDBQuery).toHaveBeenCalledWith(subjectContext, entityContext);
			expect(result).toEqual([
				{ result: true },
				{ result: true },
				{ result: false },
				{ result: false },
				{ result: true }
			]);
			expect(mockLoggingClient.logRequest).not.toHaveBeenCalled();
		});

		it('should log request and response when logResults is enabled', async () => {
			const mockSpiceDBQueryClient: MockProxy<SpiceDBQueryClient> = mock<SpiceDBQueryClient>();
			const mockLoggingClient: MockProxy<LoggingClient> = mock<LoggingClient>();
			const spiceDBResult: SpiceDBResponse<EntitlementsBatchResult> = {
				result: {
					'feature-a': { result: true }
				}
			};
			mockSpiceDBQueryClient.spiceDBBatchFeatureQuery.mockResolvedValue(spiceDBResult);

			const cut = new SpiceDBEntitlementsClient(mockClientConfig, mockLoggingClient, true);
			setSpiceDBQueryClient(cut, mockSpiceDBQueryClient);
			const requestContexts: RequestContext[] = [{ type: RequestContextType.Feature, featureKey: 'feature-a' }];

			await cut.isEntitledToMany(subjectContext, requestContexts);

			expect(mockLoggingClient.logRequest).toHaveBeenCalledWith(
				{ action: 'SpiceDB:isEntitledToMany:request', subjectContext, requestContexts },
				null
			);
			expect(mockLoggingClient.logRequest).toHaveBeenCalledWith(
				{ action: 'SpiceDB:isEntitledToMany:response', subjectContext, requestContexts },
				[{ result: true }]
			);
		});

		it('should return feature fallbacks when batch query throws', async () => {
			const mockSpiceDBQueryClient: MockProxy<SpiceDBQueryClient> = mock<SpiceDBQueryClient>();
			const mockLoggingClient: MockProxy<LoggingClient> = mock<LoggingClient>();
			const error = new Error('SpiceDB Error');
			mockSpiceDBQueryClient.spiceDBBatchFeatureQuery.mockRejectedValue(error);

			const cut = new SpiceDBEntitlementsClient(mockClientConfig, mockLoggingClient, false, {
				defaultFallback: false,
				[RequestContextType.Feature]: {
					'feature-a': true
				}
			});
			setSpiceDBQueryClient(cut, mockSpiceDBQueryClient);

			const result = await cut.isEntitledToMany(subjectContext, [
				{ type: RequestContextType.Feature, featureKey: 'feature-a' },
				{ type: RequestContextType.Feature, featureKey: 'feature-b' }
			]);

			expect(mockLoggingClient.error).toHaveBeenCalledWith(error);
			expect(result).toEqual([{ result: true }, { result: false }]);
		});

		it('should reject feature requests with FGA subject context before any queries fire', async () => {
			const mockSpiceDBQueryClient: MockProxy<SpiceDBQueryClient> = mock<SpiceDBQueryClient>();
			const mockLoggingClient: MockProxy<LoggingClient> = mock<LoggingClient>();
			const fgaSubjectContext: FGASubjectContext = {
				entityType: 'team',
				key: 'team-1'
			};

			const cut = new SpiceDBEntitlementsClient(mockClientConfig, mockLoggingClient, false);
			setSpiceDBQueryClient(cut, mockSpiceDBQueryClient);

			await expect(
				cut.isEntitledToMany(fgaSubjectContext, [
					{ type: RequestContextType.Feature, featureKey: 'feature-a' },
					{ type: RequestContextType.Entity, entityType: 'doc', key: 'doc-1', action: 'read' }
				])
			).rejects.toThrow('Feature entitlement requests require user subject context');
			expect(mockSpiceDBQueryClient.spiceDBBatchFeatureQuery).not.toHaveBeenCalled();
			expect(mockSpiceDBQueryClient.spiceDBQuery).not.toHaveBeenCalled();
		});

		it('should propagate batch logging failures', async () => {
			const mockSpiceDBQueryClient: MockProxy<SpiceDBQueryClient> = mock<SpiceDBQueryClient>();
			const mockLoggingClient: MockProxy<LoggingClient> = mock<LoggingClient>();
			const error = new Error('Logging failed');
			mockLoggingClient.logRequest.mockRejectedValue(error);

			const cut = new SpiceDBEntitlementsClient(mockClientConfig, mockLoggingClient, true);
			setSpiceDBQueryClient(cut, mockSpiceDBQueryClient);

			await expect(
				cut.isEntitledToMany(subjectContext, [{ type: RequestContextType.Feature, featureKey: 'feature-a' }])
			).rejects.toThrow('Logging failed');
			expect(mockSpiceDBQueryClient.spiceDBBatchFeatureQuery).not.toHaveBeenCalled();
			expect(mockLoggingClient.error).not.toHaveBeenCalled();
		});
	});

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
			engineEndpoint: 'mock-endpoint',
			engineToken: 'mock-token'
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
			setSpiceDBQueryClient(cut, mockSpiceDBQueryClient);

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
			engineEndpoint: 'mock-endpoint',
			engineToken: 'mock-token'
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
			setSpiceDBQueryClient(cut, mockSpiceDBQueryClient);

			const result = await cut.isEntitledTo(subjectContext, requestContext);

			expect(mockSpiceDBQueryClient.spiceDBQuery).toHaveBeenCalledWith(subjectContext, requestContext);
			expect(mockLoggingClient.error).toHaveBeenCalledWith(error);
			expect(result).toEqual(expectedResult);
		});
	});

	describe('Constructor parameter validation', () => {
		const mockLoggingClient: MockProxy<LoggingClient> = mock<LoggingClient>();
		const mockClientConfig: ClientConfiguration = {
			engineEndpoint: 'mock-endpoint',
			engineToken: 'mock-token'
		};

		it('should create instance with minimal parameters', () => {
			const cut = new SpiceDBEntitlementsClient(mockClientConfig, mockLoggingClient, false);
			expect(cut).toBeInstanceOf(SpiceDBEntitlementsClient);
		});

		it('should create instance with all parameters', () => {
			const fallbackConfig: FallbackConfiguration = { defaultFallback: true };
			const cut = new SpiceDBEntitlementsClient(mockClientConfig, mockLoggingClient, true, fallbackConfig);
			expect(cut).toBeInstanceOf(SpiceDBEntitlementsClient);
		});
	});

	describe('Edge cases and error scenarios', () => {
		const mockSpiceDBQueryClient: MockProxy<SpiceDBQueryClient> = mock<SpiceDBQueryClient>();
		const mockLoggingClient: MockProxy<LoggingClient> = mock<LoggingClient>();
		const mockClientConfig: ClientConfiguration = {
			engineEndpoint: 'mock-endpoint',
			engineToken: 'mock-token'
		};

		it('should handle undefined result gracefully', async () => {
			// Mock a response with empty result
			const emptyResult: SpiceDBResponse<EntitlementsResult> = {
				result: { result: false }
			};
			mockSpiceDBQueryClient.spiceDBQuery.mockResolvedValue(emptyResult);

			const cut = new SpiceDBEntitlementsClient(mockClientConfig, mockLoggingClient, false);
			// Replace the internal spiceDBQueryClient with our mock
			setSpiceDBQueryClient(cut, mockSpiceDBQueryClient);

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
			setSpiceDBQueryClient(cut, mockSpiceDBQueryClient);

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
			setSpiceDBQueryClient(cut, mockSpiceDBQueryClient);

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
