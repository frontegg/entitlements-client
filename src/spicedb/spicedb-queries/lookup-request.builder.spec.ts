import { v1 } from '@authzed/authzed-node';
import { buildLookupResourcesRequest, buildLookupSubjectsRequest } from './lookup-request.builder';

describe('lookup-request.builder', () => {
	describe('buildLookupResourcesRequest', () => {
		it('should build request with all parameters', () => {
			const result = buildLookupResourcesRequest({
				subjectType: 'user',
				subjectId: 'user-123',
				resourceType: 'document',
				permission: 'read',
				limit: 100,
				cursor: 'cursor-token'
			});

			expect(result.resourceObjectType).toBe('document');
			expect(result.permission).toBe('read');
			expect(result.subject?.object?.objectType).toBe('user');
			expect(result.subject?.object?.objectId).toBe('user-123');
			expect(result.subject?.optionalRelation).toBe('');
			expect(result.optionalLimit).toBe(100);
			expect(result.optionalCursor?.token).toBe('cursor-token');
		});

		it('should build request without cursor when not provided', () => {
			const result = buildLookupResourcesRequest({
				subjectType: 'user',
				subjectId: 'user-123',
				resourceType: 'document',
				permission: 'read',
				limit: 50
			});

			expect(result.optionalCursor).toBeUndefined();
		});

		it('should create valid v1.LookupResourcesRequest', () => {
			const result = buildLookupResourcesRequest({
				subjectType: 'user',
				subjectId: 'user-123',
				resourceType: 'document',
				permission: 'read',
				limit: 50
			});

			// Verify it's a valid LookupResourcesRequest structure
			expect(result).toHaveProperty('resourceObjectType');
			expect(result).toHaveProperty('permission');
			expect(result).toHaveProperty('subject');
			expect(result).toHaveProperty('optionalLimit');
		});
	});

	describe('buildLookupSubjectsRequest', () => {
		it('should build request with all parameters', () => {
			const result = buildLookupSubjectsRequest({
				resourceType: 'document',
				resourceId: 'doc-123',
				subjectType: 'user',
				permission: 'view'
			});

			expect(result.resource?.objectType).toBe('document');
			expect(result.resource?.objectId).toBe('doc-123');
			expect(result.permission).toBe('view');
			expect(result.subjectObjectType).toBe('user');
		});

		it('should create valid v1.LookupSubjectsRequest', () => {
			const result = buildLookupSubjectsRequest({
				resourceType: 'document',
				resourceId: 'doc-123',
				subjectType: 'user',
				permission: 'view'
			});

			// Verify it's a valid LookupSubjectsRequest structure
			expect(result).toHaveProperty('resource');
			expect(result).toHaveProperty('permission');
			expect(result).toHaveProperty('subjectObjectType');
		});

		it('should handle different resource types', () => {
			const result = buildLookupSubjectsRequest({
				resourceType: 'folder',
				resourceId: 'folder-456',
				subjectType: 'group',
				permission: 'admin'
			});

			expect(result.resource?.objectType).toBe('folder');
			expect(result.resource?.objectId).toBe('folder-456');
			expect(result.subjectObjectType).toBe('group');
			expect(result.permission).toBe('admin');
		});
	});
});
