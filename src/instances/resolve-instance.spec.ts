import { InstanceRegistry } from './instance-registry';
import { resolveInstance } from './resolve-instance';
import { LEGACY_INSTANCE_ID } from './instance.constants';
import { UnknownInstanceException } from '../exceptions/unknown-instance.exception';
import { InstanceIdRequiredException } from '../exceptions/instance-id-required.exception';
import { InstanceResolutionException } from '../exceptions/instance-resolution.exception';

const VENDOR_A = '2f9c1a44-7b0e-4a1e-9f8a-1c2d3e4f5a6b';
const VENDOR_B = '8b1d0e77-3c5a-4f2b-9d6e-7a8b9c0d1e2f';

const legacy = (): InstanceRegistry => new InstanceRegistry({});
const single = (): InstanceRegistry => new InstanceRegistry({ instances: [{ instanceId: 'a', vendorId: VENDOR_A }] });
const pair = (defaultInstanceId?: string): InstanceRegistry =>
	new InstanceRegistry({
		instances: [
			{ instanceId: 'a', vendorId: VENDOR_A },
			{ instanceId: 'b', vendorId: VENDOR_B }
		],
		defaultInstanceId
	});

function catchError(fn: () => unknown): unknown {
	try {
		fn();
	} catch (err) {
		return err;
	}
	return undefined;
}

describe(resolveInstance.name, () => {
	it('rule 1: should resolve an explicitly given instanceId', () => {
		expect(resolveInstance(pair(), 'b').instanceId).toBe('b');
	});

	it('rule 1: should throw UnknownInstanceException for an unconfigured instanceId', () => {
		expect(() => resolveInstance(pair(), 'nope')).toThrow(UnknownInstanceException);
		expect(catchError(() => resolveInstance(pair(), 'nope'))).toBeInstanceOf(InstanceResolutionException);
	});

	it('rule 1: should name the configured instances when the instanceId is unknown', () => {
		expect(() => resolveInstance(pair(), 'nope')).toThrow("Unknown instanceId 'nope'; configured instances: a, b");
	});

	it('rule 1: should treat an empty instanceId as unknown rather than omitted', () => {
		expect(() => resolveInstance(single(), '')).toThrow(UnknownInstanceException);
	});

	it('rule 1: should say no instances are configured when a legacy client is given an instanceId', () => {
		const error = catchError(() => resolveInstance(legacy(), 'eu'));

		expect(error).toBeInstanceOf(UnknownInstanceException);
		expect(error).toMatchObject({ instanceId: 'eu', configuredInstanceIds: [] });
		expect(() => resolveInstance(legacy(), 'eu')).toThrow("Unknown instanceId 'eu'; no instances are configured");
	});

	it('rule 2: should use the only instance when instanceId is omitted', () => {
		expect(resolveInstance(single()).instanceId).toBe('a');
	});

	it.each([[undefined], [null]])('rule 2: should treat %s as an omitted instanceId', (instanceId) => {
		expect(resolveInstance(single(), instanceId).instanceId).toBe('a');
	});

	it('rule 2: should use the legacy instance when no instances are configured', () => {
		expect(resolveInstance(legacy()).instanceId).toBe(LEGACY_INSTANCE_ID);
	});

	it('rule 3: should fall back to defaultInstanceId', () => {
		expect(resolveInstance(pair('b')).instanceId).toBe('b');
	});

	it('rule 4: should throw InstanceIdRequiredException when ambiguous', () => {
		expect(() => resolveInstance(pair())).toThrow(InstanceIdRequiredException);
		expect(catchError(() => resolveInstance(pair()))).toBeInstanceOf(InstanceResolutionException);
	});

	it('should name the configured instances in the ambiguity error', () => {
		expect(() => resolveInstance(pair())).toThrow('a, b');
	});
});
