import { SpiceDBEntitlementsClient } from './spicedb-entitlements.client';
import { mock, MockProxy } from 'jest-mock-extended';
import { LoggingClient } from '../logging';
import { ClientConfiguration } from '../client-configuration';
import { v1 } from '@authzed/authzed-node';
import { LookupEntitiesRequest } from '../types';
import { encodeObjectId } from './spicedb-queries/base64.utils';

describe('SpiceDBEntitlementsClient.lookupEntities', () => {
	let mockSpiceClient: MockProxy<v1.ZedPromiseClientInterface>;
	let mockLoggingClient: MockProxy<LoggingClient>;
	let client: SpiceDBEntitlementsClient;

	const mockClientConfig: ClientConfiguration = {
		engineEndpoint: 'mock-endpoint',
		engineToken: 'mock-token'
	};

	const defaultRequest: LookupEntitiesRequest = {
		TargetEntityType: 'document',
		TargetEntityId: 'doc-123',
		entityType: 'user',
		action: 'view'
	};

	beforeEach(() => {
		mockSpiceClient = mock<v1.ZedPromiseClientInterface>();
		mockLoggingClient = mock<LoggingClient>();
		client = new SpiceDBEntitlementsClient(mockClientConfig, mockLoggingClient, false);
		// Replace the internal spiceClient with our mock
		(client as any).spiceClient = mockSpiceClient;
	});

	describe('successful lookups', () => {
		it('should return entities with correct structure (decoded from base64)', async () => {
			// SpiceDB returns base64-encoded IDs
			const mockResults: v1.LookupSubjectsResponse[] = [
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
			mockSpiceClient.lookupSubjects.mockResolvedValue(mockResults);

			const result = await client.lookupEntities(defaultRequest);

			expect(result.entities).toHaveLength(2);
			// Response should contain decoded IDs
			expect(result.entities[0]).toEqual({
				entityType: 'user',
				entityId: 'user-1',
				permissionship: 'HAS_PERMISSION'
			});
			expect(result.entities[1]).toEqual({
				entityType: 'user',
				entityId: 'user-2',
				permissionship: 'CONDITIONAL_PERMISSION'
			});
			expect(result.totalReturned).toBe(2);
		});

		it('should return empty entities array when no results', async () => {
			mockSpiceClient.lookupSubjects.mockResolvedValue([]);

			const result = await client.lookupEntities(defaultRequest);

			expect(result.entities).toHaveLength(0);
			expect(result.totalReturned).toBe(0);
		});

		it('should build correct SpiceDB request with base64-encoded TargetEntityId', async () => {
			mockSpiceClient.lookupSubjects.mockResolvedValue([]);

			await client.lookupEntities(defaultRequest);

			expect(mockSpiceClient.lookupSubjects).toHaveBeenCalledWith(
				expect.objectContaining({
					resource: expect.objectContaining({
						objectType: 'document',
						objectId: encodeObjectId('doc-123') // Request should encode the ID
					}),
					permission: 'view',
					subjectObjectType: 'user'
				})
			);
		});
	});

	describe('permissionship mapping', () => {
		it('should map HAS_PERMISSION correctly', async () => {
			const mockResults: v1.LookupSubjectsResponse[] = [
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
				}
			];
			mockSpiceClient.lookupSubjects.mockResolvedValue(mockResults);

			const result = await client.lookupEntities(defaultRequest);

			expect(result.entities[0].permissionship).toBe('HAS_PERMISSION');
		});

		it('should map CONDITIONAL_PERMISSION correctly', async () => {
			const mockResults: v1.LookupSubjectsResponse[] = [
				{
					lookedUpAt: undefined,
					subjectObjectId: encodeObjectId('user-1'),
					excludedSubjectIds: [],
					permissionship: v1.LookupPermissionship.CONDITIONAL_PERMISSION,
					partialCaveatInfo: undefined,
					subject: {
						subjectObjectId: encodeObjectId('user-1'),
						permissionship: v1.LookupPermissionship.CONDITIONAL_PERMISSION,
						partialCaveatInfo: undefined
					},
					excludedSubjects: [],
					afterResultCursor: undefined
				}
			];
			mockSpiceClient.lookupSubjects.mockResolvedValue(mockResults);

			const result = await client.lookupEntities(defaultRequest);

			expect(result.entities[0].permissionship).toBe('CONDITIONAL_PERMISSION');
		});

		it('should map UNSPECIFIED to undefined', async () => {
			const mockResults: v1.LookupSubjectsResponse[] = [
				{
					lookedUpAt: undefined,
					subjectObjectId: encodeObjectId('user-1'),
					excludedSubjectIds: [],
					permissionship: v1.LookupPermissionship.UNSPECIFIED,
					partialCaveatInfo: undefined,
					subject: {
						subjectObjectId: encodeObjectId('user-1'),
						permissionship: v1.LookupPermissionship.UNSPECIFIED,
						partialCaveatInfo: undefined
					},
					excludedSubjects: [],
					afterResultCursor: undefined
				}
			];
			mockSpiceClient.lookupSubjects.mockResolvedValue(mockResults);

			const result = await client.lookupEntities(defaultRequest);

			expect(result.entities[0].permissionship).toBeUndefined();
		});

		it('should handle missing subject gracefully', async () => {
			const mockResults: v1.LookupSubjectsResponse[] = [
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
			mockSpiceClient.lookupSubjects.mockResolvedValue(mockResults);

			const result = await client.lookupEntities(defaultRequest);

			expect(result.entities[0].entityId).toBe('');
			expect(result.entities[0].permissionship).toBeUndefined();
		});
	});

	describe('error handling', () => {
		it('should propagate SpiceDB errors', async () => {
			const spiceDBError = new Error('SpiceDB error');
			mockSpiceClient.lookupSubjects.mockRejectedValue(spiceDBError);

			await expect(client.lookupEntities(defaultRequest)).rejects.toThrow('SpiceDB error');
		});

		it('should log error before throwing', async () => {
			const spiceDBError = new Error('SpiceDB error');
			mockSpiceClient.lookupSubjects.mockRejectedValue(spiceDBError);

			await expect(client.lookupEntities(defaultRequest)).rejects.toThrow();

			expect(mockLoggingClient.error).toHaveBeenCalledWith(spiceDBError);
		});
	});

	describe('result ordering', () => {
		it('should preserve the order of results from SpiceDB', async () => {
			const mockResults: v1.LookupSubjectsResponse[] = [
				{
					lookedUpAt: undefined,
					subjectObjectId: encodeObjectId('first'),
					excludedSubjectIds: [],
					permissionship: v1.LookupPermissionship.HAS_PERMISSION,
					partialCaveatInfo: undefined,
					subject: {
						subjectObjectId: encodeObjectId('first'),
						permissionship: v1.LookupPermissionship.HAS_PERMISSION,
						partialCaveatInfo: undefined
					},
					excludedSubjects: [],
					afterResultCursor: undefined
				},
				{
					lookedUpAt: undefined,
					subjectObjectId: encodeObjectId('second'),
					excludedSubjectIds: [],
					permissionship: v1.LookupPermissionship.HAS_PERMISSION,
					partialCaveatInfo: undefined,
					subject: {
						subjectObjectId: encodeObjectId('second'),
						permissionship: v1.LookupPermissionship.HAS_PERMISSION,
						partialCaveatInfo: undefined
					},
					excludedSubjects: [],
					afterResultCursor: undefined
				},
				{
					lookedUpAt: undefined,
					subjectObjectId: encodeObjectId('third'),
					excludedSubjectIds: [],
					permissionship: v1.LookupPermissionship.HAS_PERMISSION,
					partialCaveatInfo: undefined,
					subject: {
						subjectObjectId: encodeObjectId('third'),
						permissionship: v1.LookupPermissionship.HAS_PERMISSION,
						partialCaveatInfo: undefined
					},
					excludedSubjects: [],
					afterResultCursor: undefined
				}
			];
			mockSpiceClient.lookupSubjects.mockResolvedValue(mockResults);

			const result = await client.lookupEntities(defaultRequest);

			expect(result.entities.map((s) => s.entityId)).toEqual(['first', 'second', 'third']);
		});
	});

	describe('logging', () => {
		it('should log request and results when logResults is enabled', async () => {
			const clientWithLogging = new SpiceDBEntitlementsClient(mockClientConfig, mockLoggingClient, true);
			(clientWithLogging as any).spiceClient = mockSpiceClient;

			const mockResults: v1.LookupSubjectsResponse[] = [];
			mockSpiceClient.lookupSubjects.mockResolvedValue(mockResults);

			await clientWithLogging.lookupEntities(defaultRequest);

			expect(mockLoggingClient.logRequest).toHaveBeenCalledWith(expect.anything(), mockResults);
		});

		it('should not log when logResults is disabled', async () => {
			const mockResults: v1.LookupSubjectsResponse[] = [];
			mockSpiceClient.lookupSubjects.mockResolvedValue(mockResults);

			await client.lookupEntities(defaultRequest);

			expect(mockLoggingClient.logRequest).not.toHaveBeenCalled();
		});
	});
});
