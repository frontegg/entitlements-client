import { EntitlementsClient } from './entitlements.client';
import { mock, MockProxy } from 'jest-mock-extended';
import { EntitlementsOpaQuery } from './opa-queries';
import { LoggingClient } from './logging';
import { EntitlementsResult, OpaResponse, RequestContext, RequestContextType } from './types';
import { FallbackConfiguration } from './client-configuration';

describe(EntitlementsClient.name, () => {
	describe.each(Object.values(RequestContextType))(
		'Given monitoring mode in opa is disabled for `%s` request context type',
		(requestContextType) => {
			// GIVEN
			const mockOpaQueryClient: MockProxy<EntitlementsOpaQuery> = mock<EntitlementsOpaQuery>();
			const mockLoggingClient: MockProxy<LoggingClient> = mock<LoggingClient>();
			const opaResult: OpaResponse<EntitlementsResult> = {
				decision_id: 'mock-decision-id',
				metrics: {},
				result: {}
			};
			mockOpaQueryClient.query.mockResolvedValue(opaResult);
			const subjectContext = {
				userId: 'mock-user-id',
				tenantId: 'mock-tenant-id',
				permissions: ['mock-permission'],
				attributes: { mockAttribute: 'mock-value' }
			};
			// Don't care about actual request context, just need to pass it to the query method
			const requestContext = {
				type: requestContextType,
				path: 'mock-path',
				method: 'mock-method',
				permissionKey: 'mock-permission-key',
				featureKey: 'mock-feature'
			};

			it('should not log results if logResults flag is turned off ', async () => {
				//WHEN logging: false
				const cut = new EntitlementsClient(mockOpaQueryClient, mockLoggingClient, false);
				const res = await cut.isEntitledTo(subjectContext, requestContext);

				// THEN
				expect(mockLoggingClient.log).not.toHaveBeenCalledWith(opaResult);
			});

			it('should log results if logResults flag is turned on ', async () => {
				//WHEN logging: true
				const cut = new EntitlementsClient(mockOpaQueryClient, mockLoggingClient, true);
				const res = await cut.isEntitledTo(subjectContext, requestContext);

				// THEN
				expect(mockLoggingClient.log).toHaveBeenCalledWith(opaResult);
			});
		}
	);

	describe.each(Object.values(RequestContextType))(
		'Given monitoring mode in opa is turned on for `%s` request context type',
		(requestContextType) => {
			// GIVEN
			const mockOpaQueryClient: MockProxy<EntitlementsOpaQuery> = mock<EntitlementsOpaQuery>();
			const mockLoggingClient: MockProxy<LoggingClient> = mock<LoggingClient>();
			const opaResult: OpaResponse<EntitlementsResult> = {
				decision_id: 'mock-decision-id',
				metrics: {},
				result: {
					result: false,
					monitoring: true
				}
			};
			mockOpaQueryClient.query.mockResolvedValue(opaResult);
			const subjectContext = {
				userId: 'mock-user-id',
				tenantId: 'mock-tenant-id',
				permissions: ['mock-permission'],
				attributes: { mockAttribute: 'mock-value' }
			};
			// Don't care about actual request context, just need to pass it to the query method
			const requestContext = {
				type: requestContextType,
				path: 'mock-path',
				method: 'mock-method',
				permissionKey: 'mock-permission-key',
				featureKey: 'mock-feature'
			};

			it('should log results if logResults flag is turned off and return a default response', async () => {
				//WHEN logging: false
				const cut = new EntitlementsClient(mockOpaQueryClient, mockLoggingClient, false);
				const res = await cut.isEntitledTo(subjectContext, requestContext);

				// THEN
				expect(mockLoggingClient.log).toHaveBeenCalledWith(opaResult);
				expect(res).toEqual({ monitoring: true, result: true });
			});

			it('should log results if logResults flag is turned on and return a default response', async () => {
				//WHEN logging: true
				const cut = new EntitlementsClient(mockOpaQueryClient, mockLoggingClient, true);
				const res = await cut.isEntitledTo(subjectContext, requestContext);

				// THEN
				expect(mockLoggingClient.log).toHaveBeenCalledWith(opaResult);
				expect(res).toEqual({ monitoring: true, result: true });
			});
		}
	);

	describe.each(Object.values(RequestContextType))(
		'Given monitoring mode in opa is turned on for `%s` request context type',
		(requestContextType) => {
			// GIVEN
			const mockOpaQueryClient: MockProxy<EntitlementsOpaQuery> = mock<EntitlementsOpaQuery>();
			const mockLoggingClient: MockProxy<LoggingClient> = mock<LoggingClient>();
			const error = new Error('Test Error');
			mockOpaQueryClient.query.mockRejectedValue(error);
			const subjectContext = {
				userId: 'mock-user-id',
				tenantId: 'mock-tenant-id',
				permissions: ['mock-permission'],
				attributes: { mockAttribute: 'mock-value' }
			};
			// Don't care about actual request context, just need to pass it to the query method
			const requestContext = {
				type: requestContextType,
				path: 'mock-path',
				method: 'mock-method',
				permissionKey: 'mock-permission-key',
				featureKey: 'mock-feature'
			};

			it('should log error and return default EntitlementClient fallback of false', async () => {
				const cut = new EntitlementsClient(mockOpaQueryClient, mockLoggingClient, false);
				const res = await cut.isEntitledTo(subjectContext, requestContext);

				expect(mockLoggingClient.error).toHaveBeenCalledWith(error);
				expect(res).toEqual({ result: false });
			});

			it('should log error and return configured EntitlementClient fallback of true', async () => {
				const cut = new EntitlementsClient(mockOpaQueryClient, mockLoggingClient, false, {
					defaultFallback: true
				});
				const res = await cut.isEntitledTo(subjectContext, requestContext);

				expect(mockLoggingClient.error).toHaveBeenCalledWith(error);
				expect(res).toEqual({ result: true });
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
		]
	])('Given fallback configurations', (requestContext, expectedResult) => {
		const mockOpaQueryClient: MockProxy<EntitlementsOpaQuery> = mock<EntitlementsOpaQuery>();
		const mockLoggingClient: MockProxy<LoggingClient> = mock<LoggingClient>();
		const error = new Error('Test Error');
		mockOpaQueryClient.query.mockRejectedValue(error);
		const fallbackConfiguration: FallbackConfiguration = {
			defaultFallback: false,
			feature: [{ featureKey: 'test-feature', fallback: true }],
			permission: [{ permissionKey: 'test.permission', fallback: true }],
			route: [{ method: 'GET', path: '/users', fallback: true }]
		};
		const subjectContext = {
			userId: 'mock-user-id',
			tenantId: 'mock-tenant-id',
			permissions: ['mock-permission'],
			attributes: { mockAttribute: 'mock-value' }
		};

		it('should pick specific fallback if configured, otherwise fallback to default', async () => {
			const cut = new EntitlementsClient(mockOpaQueryClient, mockLoggingClient, false, fallbackConfiguration);
			const res = await cut.isEntitledTo(subjectContext, requestContext);

			expect(mockLoggingClient.error).toHaveBeenCalledWith(error);
			expect(res).toEqual(expectedResult);
		});
	});
});
