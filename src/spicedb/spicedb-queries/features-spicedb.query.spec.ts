import { v1 } from '@authzed/authzed-node';
import { mock, MockProxy, mockReset } from 'jest-mock-extended';
import { FeaturesSpiceDBQuery } from './features-spicedb.query';
import { EntitlementsSpiceDBQueryCommonTests } from './entitlements-spicedb.query.spec-helper';
import { EntitlementsDynamicQueryRequestContext, RequestContextType, UserSubjectContext } from '../../types';

describe(FeaturesSpiceDBQuery.name, () => {
	EntitlementsSpiceDBQueryCommonTests<FeaturesSpiceDBQuery, RequestContextType.Feature>(
		FeaturesSpiceDBQuery,
		'feature',
		(requestContext: EntitlementsDynamicQueryRequestContext<RequestContextType.Feature>) =>
			requestContext.featureKey,
		() => ({
			requestContext: { type: RequestContextType.Feature, featureKey: 'mock-feature-key' }
		})
	);

	describe('targeting caveat context', () => {
		let queryClient: FeaturesSpiceDBQuery;
		let mockClient: MockProxy<v1.ZedPromiseClientInterface>;

		beforeEach(() => {
			mockClient = mock<v1.ZedPromiseClientInterface>();
			queryClient = new FeaturesSpiceDBQuery(mockClient);
			mockReset(mockClient);
		});

		it('should pass targeting caveat context with user_context containing "now" field', async () => {
			const requestContext: EntitlementsDynamicQueryRequestContext<RequestContextType.Feature> = {
				type: RequestContextType.Feature,
				featureKey: 'test-feature'
			};
			const subjectContext: UserSubjectContext = {
				userId: 'user-1',
				tenantId: 'tenant-1',
				permissions: [],
				attributes: { country: 'US' }
			};

			const mockResponse = v1.CheckBulkPermissionsResponse.create({
				pairs: [
					v1.CheckBulkPermissionsPair.create({
						request: v1.CheckBulkPermissionsRequestItem.create({}),
						response: {
							oneofKind: 'item',
							item: v1.CheckPermissionResponse.create({
								permissionship: v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION
							})
						}
					})
				]
			});
			mockClient.checkBulkPermissions.mockResolvedValue(mockResponse);

			await queryClient.query({ subjectContext, requestContext });

			const call = mockClient.checkBulkPermissions.mock.calls[0][0];
			const context = call.items?.[0]?.context;
			expect(context).toBeDefined();
			// Verify user_context structure for targeting caveat
			expect(context?.fields?.user_context?.kind?.oneofKind).toBe('structValue');
			const userContext = (context?.fields?.user_context?.kind as any)?.structValue?.fields;
			// Should have "now" field
			expect(userContext?.now?.kind?.oneofKind).toBe('stringValue');
			expect(userContext?.now?.kind?.stringValue).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
			// Should have custom attributes
			expect(userContext?.country?.kind?.stringValue).toBe('US');
		});
	});
});
