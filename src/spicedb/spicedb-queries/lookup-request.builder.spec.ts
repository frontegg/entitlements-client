import { v1 } from '@authzed/authzed-node';
import { buildLookupResourcesRequest, buildLookupSubjectsRequest } from './lookup-request.builder';
import { encodeObjectId } from './base64.utils';

describe('lookup-request.builder', () => {
	describe('buildLookupResourcesRequest', () => {
		it('should build request with all parameters and encode subjectId', () => {
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
			// subjectId should be base64 encoded
			expect(result.subject?.object?.objectId).toBe(encodeObjectId('user-123'));
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

		it('should encode subjectId to URL-safe base64', () => {
			const result = buildLookupResourcesRequest({
				subjectType: 'user',
				subjectId: 'user+special/chars=test',
				resourceType: 'document',
				permission: 'read',
				limit: 50
			});

			const encodedId = result.subject?.object?.objectId;
			// Should not contain +, /, or = (URL-safe base64)
			expect(encodedId).not.toContain('+');
			expect(encodedId).not.toContain('/');
			expect(encodedId).not.toContain('=');
		});
	});

	describe('buildLookupSubjectsRequest', () => {
		it('should build request with all parameters and encode resourceId', () => {
			const result = buildLookupSubjectsRequest({
				resourceType: 'document',
				resourceId: 'doc-123',
				subjectType: 'user',
				permission: 'view'
			});

			expect(result.resource?.objectType).toBe('document');
			// resourceId should be base64 encoded
			expect(result.resource?.objectId).toBe(encodeObjectId('doc-123'));
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

		it('should handle different resource types and encode resourceId', () => {
			const result = buildLookupSubjectsRequest({
				resourceType: 'folder',
				resourceId: 'folder-456',
				subjectType: 'group',
				permission: 'admin'
			});

			expect(result.resource?.objectType).toBe('folder');
			expect(result.resource?.objectId).toBe(encodeObjectId('folder-456'));
			expect(result.subjectObjectType).toBe('group');
			expect(result.permission).toBe('admin');
		});

		it('should encode resourceId to URL-safe base64', () => {
			const result = buildLookupSubjectsRequest({
				resourceType: 'document',
				resourceId: 'doc+special/chars=test',
				subjectType: 'user',
				permission: 'view'
			});

			const encodedId = result.resource?.objectId;
			// Should not contain +, /, or = (URL-safe base64)
			expect(encodedId).not.toContain('+');
			expect(encodedId).not.toContain('/');
			expect(encodedId).not.toContain('=');
		});
	});
});
