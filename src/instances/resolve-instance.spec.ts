import { randomUUID } from 'node:crypto';
import { InstanceRegistry } from './instance-registry';
import { resolveInstance } from './resolve-instance';
import { LEGACY_INSTANCE_ID } from './instance.constants';
import { UnknownInstanceException } from '../exceptions/unknown-instance.exception';
import { InstanceIdRequiredException } from '../exceptions/instance-id-required.exception';
import { InstanceResolutionException } from '../exceptions/instance-resolution.exception';

const VENDOR_A = randomUUID();
const VENDOR_B = randomUUID();
const INSTANCE_A = randomUUID();
const INSTANCE_B = randomUUID();
const UNKNOWN_INSTANCE = randomUUID();

const legacy = (): InstanceRegistry => new InstanceRegistry({});
const single = (): InstanceRegistry =>
	new InstanceRegistry({ instances: [{ instanceId: INSTANCE_A, vendorId: VENDOR_A }] });
const pair = (defaultInstanceId?: string): InstanceRegistry =>
	new InstanceRegistry({
		instances: [
			{ instanceId: INSTANCE_A, vendorId: VENDOR_A },
			{ instanceId: INSTANCE_B, vendorId: VENDOR_B }
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
		expect(resolveInstance(pair(), INSTANCE_B).instanceId).toBe(INSTANCE_B);
	});

	it('should throw UnknownInstanceException for an unconfigured instanceId', () => {
		expect(() => resolveInstance(pair(), UNKNOWN_INSTANCE)).toThrow(UnknownInstanceException);
		expect(catchError(() => resolveInstance(pair(), UNKNOWN_INSTANCE))).toBeInstanceOf(InstanceResolutionException);
	});

	it('should name the configured instances when the instanceId is unknown', () => {
		expect(() => resolveInstance(pair(), UNKNOWN_INSTANCE)).toThrow(
			`Unknown instanceId '${UNKNOWN_INSTANCE}'; configured instances: ${INSTANCE_A}, ${INSTANCE_B}`
		);
	});

	it('should treat an empty instanceId as unknown rather than omitted', () => {
		expect(() => resolveInstance(single(), '')).toThrow(UnknownInstanceException);
	});

	it('should say no instances are configured when a legacy client is given an instanceId', () => {
		const error = catchError(() => resolveInstance(legacy(), UNKNOWN_INSTANCE));

		expect(error).toBeInstanceOf(UnknownInstanceException);
		expect(error).toMatchObject({ instanceId: UNKNOWN_INSTANCE, configuredInstanceIds: [] });
		expect(() => resolveInstance(legacy(), UNKNOWN_INSTANCE)).toThrow(
			`Unknown instanceId '${UNKNOWN_INSTANCE}'; no instances are configured`
		);
	});

	it('should use the only instance when instanceId is omitted', () => {
		expect(resolveInstance(single()).instanceId).toBe(INSTANCE_A);
	});

	it.each([[undefined], [null]])('should treat %s as an omitted instanceId', (instanceId) => {
		expect(resolveInstance(single(), instanceId).instanceId).toBe(INSTANCE_A);
	});

	it('should use the legacy instance when no instances are configured', () => {
		expect(resolveInstance(legacy()).instanceId).toBe(LEGACY_INSTANCE_ID);
	});

	it('should fall back to defaultInstanceId when instanceId is omitted', () => {
		expect(resolveInstance(pair(INSTANCE_B)).instanceId).toBe(INSTANCE_B);
	});

	it('should throw InstanceIdRequiredException when instanceId is omitted and several instances have no default', () => {
		expect(() => resolveInstance(pair())).toThrow(InstanceIdRequiredException);
		expect(catchError(() => resolveInstance(pair()))).toBeInstanceOf(InstanceResolutionException);
	});

	it('should name the configured instances in the ambiguity error', () => {
		expect(() => resolveInstance(pair())).toThrow(`${INSTANCE_A}, ${INSTANCE_B}`);
	});

	it.each([
		['UnknownInstanceException', (): unknown => resolveInstance(pair(), UNKNOWN_INSTANCE)],
		['InstanceIdRequiredException', (): unknown => resolveInstance(pair())]
	])('should name the thrown error %s', (name, resolve) => {
		expect(catchError(resolve)).toMatchObject({ name });
	});
});
