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
	it('should resolve an explicitly given instanceId', () => {
		expect(resolveInstance(pair(), 'b').instanceId).toBe('b');
	});

	it('should throw UnknownInstanceException for an unconfigured instanceId', () => {
		expect(() => resolveInstance(pair(), 'nope')).toThrow(UnknownInstanceException);
		expect(catchError(() => resolveInstance(pair(), 'nope'))).toBeInstanceOf(InstanceResolutionException);
	});

	it('should name the configured instances when the instanceId is unknown', () => {
		expect(() => resolveInstance(pair(), 'nope')).toThrow("Unknown instanceId 'nope'; configured instances: a, b");
	});

	it('should treat an empty instanceId as unknown rather than omitted', () => {
		expect(() => resolveInstance(single(), '')).toThrow(UnknownInstanceException);
	});

	it('should say no instances are configured when a legacy client is given an instanceId', () => {
		const error = catchError(() => resolveInstance(legacy(), 'eu'));

		expect(error).toBeInstanceOf(UnknownInstanceException);
		expect(error).toMatchObject({ instanceId: 'eu', configuredInstanceIds: [] });
		expect(() => resolveInstance(legacy(), 'eu')).toThrow("Unknown instanceId 'eu'; no instances are configured");
	});

	it('should use the only instance when instanceId is omitted', () => {
		expect(resolveInstance(single()).instanceId).toBe('a');
	});

	it.each([[undefined], [null]])('should treat %s as an omitted instanceId', (instanceId) => {
		expect(resolveInstance(single(), instanceId).instanceId).toBe('a');
	});

	it('should use the legacy instance when no instances are configured', () => {
		expect(resolveInstance(legacy()).instanceId).toBe(LEGACY_INSTANCE_ID);
	});

	it('should fall back to defaultInstanceId when instanceId is omitted', () => {
		expect(resolveInstance(pair('b')).instanceId).toBe('b');
	});

	it('should throw InstanceIdRequiredException when instanceId is omitted and several instances have no default', () => {
		expect(() => resolveInstance(pair())).toThrow(InstanceIdRequiredException);
		expect(catchError(() => resolveInstance(pair()))).toBeInstanceOf(InstanceResolutionException);
	});

	it('should name the configured instances in the ambiguity error', () => {
		expect(() => resolveInstance(pair())).toThrow('a, b');
	});

	it.each([
		['UnknownInstanceException', (): unknown => resolveInstance(pair(), 'nope')],
		['InstanceIdRequiredException', (): unknown => resolveInstance(pair())]
	])('should name the thrown error %s', (name, resolve) => {
		expect(catchError(resolve)).toMatchObject({ name });
	});
});
