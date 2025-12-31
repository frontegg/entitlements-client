import { v1 } from '@authzed/authzed-node';
import { mapLookupTargetEntitiesResponse, mapLookupEntitiesResponse } from './lookup-response.mapper';
import { permissionshipMap } from '../lookup.constants';
import { encodeObjectId } from './base64.utils';

describe('lookup-response.mapper', () => {
	describe('mapPermissionship', () => {
		it('should map HAS_PERMISSION', () => {
			expect(permissionshipMap.get(v1.LookupPermissionship.HAS_PERMISSION)).toBe('HAS_PERMISSION');
		});

		it('should map CONDITIONAL_PERMISSION', () => {
			expect(permissionshipMap.get(v1.LookupPermissionship.CONDITIONAL_PERMISSION)).toBe(
				'CONDITIONAL_PERMISSION'
			);
		});

		it('should map UNSPECIFIED to undefined', () => {
			expect(permissionshipMap.get(v1.LookupPermissionship.UNSPECIFIED)).toBeUndefined();
		});

		it('should map unknown values to undefined', () => {
			expect(permissionshipMap.get(999 as v1.LookupPermissionship)).toBeUndefined();
		});
	});

	describe('mapLookupTargetEntitiesResponse', () => {
		it('should map targets correctly and decode base64 TargetEntityIds', () => {
			// SpiceDB returns base64 encoded IDs
			const results: v1.LookupResourcesResponse[] = [
				{
					lookedUpAt: undefined,
					resourceObjectId: encodeObjectId('resource-1'),
					permissionship: v1.LookupPermissionship.HAS_PERMISSION,
					partialCaveatInfo: undefined,
					afterResultCursor: undefined
				},
				{
					lookedUpAt: undefined,
					resourceObjectId: encodeObjectId('resource-2'),
					permissionship: v1.LookupPermissionship.CONDITIONAL_PERMISSION,
					partialCaveatInfo: undefined,
					afterResultCursor: undefined
				}
			];

			const response = mapLookupTargetEntitiesResponse(results, 'document', 50);

			expect(response.targets).toHaveLength(2);
			// Should decode to original IDs
			expect(response.targets[0]).toEqual({
				TargetEntityType: 'document',
				TargetEntityId: 'resource-1',
				permissionship: 'HAS_PERMISSION'
			});
			expect(response.targets[1]).toEqual({
				TargetEntityType: 'document',
				TargetEntityId: 'resource-2',
				permissionship: 'CONDITIONAL_PERMISSION'
			});
			expect(response.totalReturned).toBe(2);
		});

		it('should return cursor when results equal limit', () => {
			const results: v1.LookupResourcesResponse[] = Array.from({ length: 10 }, (_, i) => ({
				lookedUpAt: undefined,
				resourceObjectId: encodeObjectId(`resource-${i}`),
				permissionship: v1.LookupPermissionship.HAS_PERMISSION,
				partialCaveatInfo: undefined,
				afterResultCursor: i === 9 ? { token: 'next-cursor' } : undefined
			}));

			const response = mapLookupTargetEntitiesResponse(results, 'document', 10);

			expect(response.cursor).toBe('next-cursor');
		});

		it('should not return cursor when results less than limit', () => {
			const results: v1.LookupResourcesResponse[] = [
				{
					lookedUpAt: undefined,
					resourceObjectId: encodeObjectId('resource-1'),
					permissionship: v1.LookupPermissionship.HAS_PERMISSION,
					partialCaveatInfo: undefined,
					afterResultCursor: { token: 'cursor-token' }
				}
			];

			const response = mapLookupTargetEntitiesResponse(results, 'document', 50);

			expect(response.cursor).toBeUndefined();
		});

		it('should handle empty results', () => {
			const response = mapLookupTargetEntitiesResponse([], 'document', 50);

			expect(response.targets).toHaveLength(0);
			expect(response.totalReturned).toBe(0);
			expect(response.cursor).toBeUndefined();
		});

		it('should decode base64 IDs with special characters correctly', () => {
			const originalId = 'doc-1-aOD3DYIF';
			const results: v1.LookupResourcesResponse[] = [
				{
					lookedUpAt: undefined,
					resourceObjectId: encodeObjectId(originalId),
					permissionship: v1.LookupPermissionship.HAS_PERMISSION,
					partialCaveatInfo: undefined,
					afterResultCursor: undefined
				}
			];

			const response = mapLookupTargetEntitiesResponse(results, 'document', 50);

			expect(response.targets[0].TargetEntityId).toBe(originalId);
		});
	});

	describe('mapLookupEntitiesResponse', () => {
		it('should map entities correctly and decode base64 entityIds', () => {
			// SpiceDB returns base64 encoded IDs
			const results: v1.LookupSubjectsResponse[] = [
				{
					lookedUpAt: undefined,
					subjectObjectId: encodeObjectId('user-1'),
					excludedSubjectIds: [],
					permissionship: v1.LookupPermissionship.HAS_PERMISSION,
					partialCaveatInfo: undefined,
					subject: {
						subjectObjectId: encodeObjectId('user-1'),
						permissionship: v1.LookupPermissionship.HAS_PERMISSION,
						partialCaveatInfo: undefined
					},
					excludedSubjects: [],
					afterResultCursor: undefined
				},
				{
					lookedUpAt: undefined,
					subjectObjectId: encodeObjectId('user-2'),
					excludedSubjectIds: [],
					permissionship: v1.LookupPermissionship.CONDITIONAL_PERMISSION,
					partialCaveatInfo: undefined,
					subject: {
						subjectObjectId: encodeObjectId('user-2'),
						permissionship: v1.LookupPermissionship.CONDITIONAL_PERMISSION,
						partialCaveatInfo: undefined
					},
					excludedSubjects: [],
					afterResultCursor: undefined
				}
			];

			const response = mapLookupEntitiesResponse(results, 'user');

			expect(response.entities).toHaveLength(2);
			// Should decode to original IDs
			expect(response.entities[0]).toEqual({
				entityType: 'user',
				entityId: 'user-1',
				permissionship: 'HAS_PERMISSION'
			});
			expect(response.entities[1]).toEqual({
				entityType: 'user',
				entityId: 'user-2',
				permissionship: 'CONDITIONAL_PERMISSION'
			});
			expect(response.totalReturned).toBe(2);
		});

		it('should handle empty results', () => {
			const response = mapLookupEntitiesResponse([], 'user');

			expect(response.entities).toHaveLength(0);
			expect(response.totalReturned).toBe(0);
		});

		it('should handle missing subject field gracefully', () => {
			const results: v1.LookupSubjectsResponse[] = [
				{
					lookedUpAt: undefined,
					subjectObjectId: encodeObjectId('user-1'),
					excludedSubjectIds: [],
					permissionship: v1.LookupPermissionship.HAS_PERMISSION,
					partialCaveatInfo: undefined,
					subject: undefined,
					excludedSubjects: [],
					afterResultCursor: undefined
				}
			];

			const response = mapLookupEntitiesResponse(results, 'user');

			expect(response.entities[0].entityId).toBe('');
			expect(response.entities[0].permissionship).toBeUndefined();
		});

		it('should use subject.permissionship instead of deprecated top-level field', () => {
			const results: v1.LookupSubjectsResponse[] = [
				{
					lookedUpAt: undefined,
					subjectObjectId: encodeObjectId('user-1'),
					excludedSubjectIds: [],
					// Deprecated top-level field says HAS_PERMISSION
					permissionship: v1.LookupPermissionship.HAS_PERMISSION,
					partialCaveatInfo: undefined,
					// But subject field says CONDITIONAL_PERMISSION
					subject: {
						subjectObjectId: encodeObjectId('user-1'),
						permissionship: v1.LookupPermissionship.CONDITIONAL_PERMISSION,
						partialCaveatInfo: undefined
					},
					excludedSubjects: [],
					afterResultCursor: undefined
				}
			];

			const response = mapLookupEntitiesResponse(results, 'user');

			// Should use the subject field value, not the deprecated top-level one
			expect(response.entities[0].permissionship).toBe('CONDITIONAL_PERMISSION');
		});

		it('should decode base64 IDs with real customer data format', () => {
			// Simulating real data like: cust_user:dXNlci0xLURXZFRQQ29I
			const originalUserId = 'user-1-DWdTPCoH';
			const results: v1.LookupSubjectsResponse[] = [
				{
					lookedUpAt: undefined,
					subjectObjectId: encodeObjectId(originalUserId),
					excludedSubjectIds: [],
					permissionship: v1.LookupPermissionship.HAS_PERMISSION,
					partialCaveatInfo: undefined,
					subject: {
						subjectObjectId: encodeObjectId(originalUserId),
						permissionship: v1.LookupPermissionship.HAS_PERMISSION,
						partialCaveatInfo: undefined
					},
					excludedSubjects: [],
					afterResultCursor: undefined
				}
			];

			const response = mapLookupEntitiesResponse(results, 'cust_user');

			expect(response.entities[0].entityId).toBe(originalUserId);
		});
	});
});
