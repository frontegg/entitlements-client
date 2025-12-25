import { v1 } from '@authzed/authzed-node';
import { mapLookupResourcesResponse, mapLookupSubjectsResponse } from './lookup-response.mapper';
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

	describe('mapLookupResourcesResponse', () => {
		it('should map resources correctly and decode base64 resourceIds', () => {
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

			const response = mapLookupResourcesResponse(results, 'document', 50);

			expect(response.resources).toHaveLength(2);
			// Should decode to original IDs
			expect(response.resources[0]).toEqual({
				resourceType: 'document',
				resourceId: 'resource-1',
				permissionship: 'HAS_PERMISSION'
			});
			expect(response.resources[1]).toEqual({
				resourceType: 'document',
				resourceId: 'resource-2',
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

			const response = mapLookupResourcesResponse(results, 'document', 10);

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

			const response = mapLookupResourcesResponse(results, 'document', 50);

			expect(response.cursor).toBeUndefined();
		});

		it('should handle empty results', () => {
			const response = mapLookupResourcesResponse([], 'document', 50);

			expect(response.resources).toHaveLength(0);
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

			const response = mapLookupResourcesResponse(results, 'document', 50);

			expect(response.resources[0].resourceId).toBe(originalId);
		});
	});

	describe('mapLookupSubjectsResponse', () => {
		it('should map subjects correctly and decode base64 subjectIds', () => {
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

			const response = mapLookupSubjectsResponse(results, 'user');

			expect(response.subjects).toHaveLength(2);
			// Should decode to original IDs
			expect(response.subjects[0]).toEqual({
				subjectType: 'user',
				subjectId: 'user-1',
				permissionship: 'HAS_PERMISSION'
			});
			expect(response.subjects[1]).toEqual({
				subjectType: 'user',
				subjectId: 'user-2',
				permissionship: 'CONDITIONAL_PERMISSION'
			});
			expect(response.totalReturned).toBe(2);
		});

		it('should handle empty results', () => {
			const response = mapLookupSubjectsResponse([], 'user');

			expect(response.subjects).toHaveLength(0);
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

			const response = mapLookupSubjectsResponse(results, 'user');

			expect(response.subjects[0].subjectId).toBe('');
			expect(response.subjects[0].permissionship).toBeUndefined();
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

			const response = mapLookupSubjectsResponse(results, 'user');

			// Should use the subject field value, not the deprecated top-level one
			expect(response.subjects[0].permissionship).toBe('CONDITIONAL_PERMISSION');
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

			const response = mapLookupSubjectsResponse(results, 'cust_user');

			expect(response.subjects[0].subjectId).toBe(originalUserId);
		});
	});
});
