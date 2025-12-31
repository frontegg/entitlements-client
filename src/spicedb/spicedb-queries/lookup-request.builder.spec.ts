import { v1 } from '@authzed/authzed-node';
import { buildLookupTargetEntitiesRequest, buildLookupEntitiesRequest } from './lookup-request.builder';
import { encodeObjectId } from './base64.utils';

describe('lookup-request.builder', () => {
	describe('buildLookupTargetEntitiesRequest', () => {
		it('should build request with all parameters and encode entityId', () => {
			const result = buildLookupTargetEntitiesRequest({
				entityType: 'user',
				entityId: 'user-123',
				TargetEntityType: 'document',
				action: 'read',
				limit: 100,
				cursor: 'cursor-token'
			});

			expect(result.resourceObjectType).toBe('document');
			expect(result.permission).toBe('read');
			expect(result.subject?.object?.objectType).toBe('user');
			// entityId should be base64 encoded
			expect(result.subject?.object?.objectId).toBe(encodeObjectId('user-123'));
			expect(result.subject?.optionalRelation).toBe('');
			expect(result.optionalLimit).toBe(100);
			expect(result.optionalCursor?.token).toBe('cursor-token');
		});

		it('should build request without cursor when not provided', () => {
			const result = buildLookupTargetEntitiesRequest({
				entityType: 'user',
				entityId: 'user-123',
				TargetEntityType: 'document',
				action: 'read',
				limit: 50
			});

			expect(result.optionalCursor).toBeUndefined();
		});

		it('should create valid v1.LookupResourcesRequest', () => {
			const result = buildLookupTargetEntitiesRequest({
				entityType: 'user',
				entityId: 'user-123',
				TargetEntityType: 'document',
				action: 'read',
				limit: 50
			});

			// Verify it's a valid LookupResourcesRequest structure
			expect(result).toHaveProperty('resourceObjectType');
			expect(result).toHaveProperty('permission');
			expect(result).toHaveProperty('subject');
			expect(result).toHaveProperty('optionalLimit');
		});

		it('should encode entityId to URL-safe base64', () => {
			const result = buildLookupTargetEntitiesRequest({
				entityType: 'user',
				entityId: 'user+special/chars=test',
				TargetEntityType: 'document',
				action: 'read',
				limit: 50
			});

			const encodedId = result.subject?.object?.objectId;
			// Should not contain +, /, or = (URL-safe base64)
			expect(encodedId).not.toContain('+');
			expect(encodedId).not.toContain('/');
			expect(encodedId).not.toContain('=');
		});
	});

	describe('buildLookupEntitiesRequest', () => {
		it('should build request with all parameters and encode TargetEntityId', () => {
			const result = buildLookupEntitiesRequest({
				TargetEntityType: 'document',
				TargetEntityId: 'doc-123',
				entityType: 'user',
				action: 'view'
			});

			expect(result.resource?.objectType).toBe('document');
			// TargetEntityId should be base64 encoded
			expect(result.resource?.objectId).toBe(encodeObjectId('doc-123'));
			expect(result.permission).toBe('view');
			expect(result.subjectObjectType).toBe('user');
		});

		it('should create valid v1.LookupSubjectsRequest', () => {
			const result = buildLookupEntitiesRequest({
				TargetEntityType: 'document',
				TargetEntityId: 'doc-123',
				entityType: 'user',
				action: 'view'
			});

			// Verify it's a valid LookupSubjectsRequest structure
			expect(result).toHaveProperty('resource');
			expect(result).toHaveProperty('permission');
			expect(result).toHaveProperty('subjectObjectType');
		});

		it('should handle different target entity types and encode TargetEntityId', () => {
			const result = buildLookupEntitiesRequest({
				TargetEntityType: 'folder',
				TargetEntityId: 'folder-456',
				entityType: 'group',
				action: 'admin'
			});

			expect(result.resource?.objectType).toBe('folder');
			expect(result.resource?.objectId).toBe(encodeObjectId('folder-456'));
			expect(result.subjectObjectType).toBe('group');
			expect(result.permission).toBe('admin');
		});

		it('should encode TargetEntityId to URL-safe base64', () => {
			const result = buildLookupEntitiesRequest({
				TargetEntityType: 'document',
				TargetEntityId: 'doc+special/chars=test',
				entityType: 'user',
				action: 'view'
			});

			const encodedId = result.resource?.objectId;
			// Should not contain +, /, or = (URL-safe base64)
			expect(encodedId).not.toContain('+');
			expect(encodedId).not.toContain('/');
			expect(encodedId).not.toContain('=');
		});
	});
});
