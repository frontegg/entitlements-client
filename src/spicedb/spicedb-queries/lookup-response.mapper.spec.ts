import { v1 } from '@authzed/authzed-node';
import { mapLookupResourcesResponse, mapLookupSubjectsResponse } from './lookup-response.mapper';
import { permissionshipMap } from '../lookup.constants';

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
		it('should map resources correctly', () => {
			const results: v1.LookupResourcesResponse[] = [
				{
					lookedUpAt: undefined,
					resourceObjectId: 'resource-1',
					permissionship: v1.LookupPermissionship.HAS_PERMISSION,
					partialCaveatInfo: undefined,
					afterResultCursor: undefined
				},
				{
					lookedUpAt: undefined,
					resourceObjectId: 'resource-2',
					permissionship: v1.LookupPermissionship.CONDITIONAL_PERMISSION,
					partialCaveatInfo: undefined,
					afterResultCursor: undefined
				}
			];

			const response = mapLookupResourcesResponse(results, 'document', 50);

			expect(response.resources).toHaveLength(2);
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
				resourceObjectId: `resource-${i}`,
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
					resourceObjectId: 'resource-1',
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
	});

	describe('mapLookupSubjectsResponse', () => {
		it('should map subjects correctly', () => {
			const results: v1.LookupSubjectsResponse[] = [
				{
					lookedUpAt: undefined,
					subjectObjectId: 'user-1',
					excludedSubjectIds: [],
					permissionship: v1.LookupPermissionship.HAS_PERMISSION,
					partialCaveatInfo: undefined,
					subject: {
						subjectObjectId: 'user-1',
						permissionship: v1.LookupPermissionship.HAS_PERMISSION,
						partialCaveatInfo: undefined
					},
					excludedSubjects: [],
					afterResultCursor: undefined
				},
				{
					lookedUpAt: undefined,
					subjectObjectId: 'user-2',
					excludedSubjectIds: [],
					permissionship: v1.LookupPermissionship.CONDITIONAL_PERMISSION,
					partialCaveatInfo: undefined,
					subject: {
						subjectObjectId: 'user-2',
						permissionship: v1.LookupPermissionship.CONDITIONAL_PERMISSION,
						partialCaveatInfo: undefined
					},
					excludedSubjects: [],
					afterResultCursor: undefined
				}
			];

			const response = mapLookupSubjectsResponse(results, 'user');

			expect(response.subjects).toHaveLength(2);
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
					subjectObjectId: 'user-1',
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
					subjectObjectId: 'user-1',
					excludedSubjectIds: [],
					// Deprecated top-level field says HAS_PERMISSION
					permissionship: v1.LookupPermissionship.HAS_PERMISSION,
					partialCaveatInfo: undefined,
					// But subject field says CONDITIONAL_PERMISSION
					subject: {
						subjectObjectId: 'user-1',
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
	});
});
