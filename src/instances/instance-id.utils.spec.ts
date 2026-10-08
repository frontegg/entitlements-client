import { isValidInstanceId } from './instance-id.utils';
import { isValidSchemaName } from './schema-prefix.utils';

const SEPARATOR = '_';

const VALID_INSTANCE_IDS = ['a', 'ab', 'abbb', 'a-bbb', 'eu-west-1', '1eu'];

const VALID_OBJECT_TYPES = ['ccc', 'b_ccc', 'bb_ccc', 'bbb_ccc', 'document'];

const joinWithSeparator = (instanceId: string, objectType: string): string => `${instanceId}${SEPARATOR}${objectType}`;

describe(isValidInstanceId.name, () => {
	it.each(VALID_INSTANCE_IDS)('should accept %j', (instanceId) => {
		expect(isValidInstanceId(instanceId)).toBe(true);
	});

	it.each([[''], ['a_b'], ['_eu'], ['eu_'], ['-eu'], ['Eu'], ['a'.repeat(64)]])('should reject %j', (instanceId) => {
		expect(isValidInstanceId(instanceId)).toBe(false);
	});

	describe('joined with an object type by an underscore', () => {
		it('should build a distinct key for every pair of a valid instanceId and a valid object type', () => {
			VALID_OBJECT_TYPES.forEach((objectType) => expect(isValidSchemaName(objectType)).toBe(true));

			const keys = VALID_INSTANCE_IDS.flatMap((instanceId) =>
				VALID_OBJECT_TYPES.map((objectType) => joinWithSeparator(instanceId, objectType))
			);

			expect(new Set(keys).size).toBe(keys.length);
		});

		it('should keep the instanceId recoverable, since no valid instanceId contains the separator', () => {
			VALID_INSTANCE_IDS.forEach((instanceId) => {
				VALID_OBJECT_TYPES.forEach((objectType) => {
					const key = joinWithSeparator(instanceId, objectType);
					const separatorAt = key.indexOf(SEPARATOR);

					expect(key.slice(0, separatorAt)).toBe(instanceId);
					expect(key.slice(separatorAt + 1)).toBe(objectType);
				});
			});
		});

		it('should refuse the instanceId that would collide with another instance through its object type', () => {
			expect(joinWithSeparator('a', 'bbb_ccc')).toBe(joinWithSeparator('a_bbb', 'ccc'));
			expect(isValidInstanceId('a')).toBe(true);
			expect(isValidSchemaName('bbb_ccc')).toBe(true);
			expect(isValidSchemaName('ccc')).toBe(true);
			expect(isValidInstanceId('a_bbb')).toBe(false);
		});
	});
});
