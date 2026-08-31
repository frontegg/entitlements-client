import { InstanceRegistry } from './instance-registry';
import { resolveInstance } from './resolve-instance';
import { UnknownInstanceException } from '../exceptions/unknown-instance.exception';
import { InstanceIdRequiredException } from '../exceptions/instance-id-required.exception';
import { InstanceResolutionException } from '../exceptions/instance-resolution.exception';
import { mock } from 'jest-mock-extended';
import { LoggingClient } from '../logging';

const VENDOR_A = '2f9c1a44-7b0e-4a1e-9f8a-1c2d3e4f5a6b';
const VENDOR_B = '8b1d0e77-3c5a-4f2b-9d6e-7a8b9c0d1e2f';

const single = (): InstanceRegistry => new InstanceRegistry({ instances: [{ instanceId: 'a', vendorId: VENDOR_A }] });
const pair = (defaultInstanceId?: string): InstanceRegistry =>
	new InstanceRegistry(
		{
			instances: [
				{ instanceId: 'a', vendorId: VENDOR_A },
				{ instanceId: 'b', vendorId: VENDOR_B }
			]
		},
		defaultInstanceId
	);

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

	it('rule 2: should use the only instance when instanceId is omitted', () => {
		expect(resolveInstance(single()).instanceId).toBe('a');
	});

	it('rule 3: should fall back to defaultInstanceId and log', () => {
		const loggingClient = mock<LoggingClient>();

		expect(resolveInstance(pair('b'), undefined, loggingClient).instanceId).toBe('b');
		expect(loggingClient.logRequest).toHaveBeenCalledWith(
			expect.objectContaining({ action: 'SpiceDB:resolveInstance:default', instanceId: 'b' }),
			null
		);
	});

	it('rule 4: should throw InstanceIdRequiredException when ambiguous', () => {
		expect(() => resolveInstance(pair())).toThrow(InstanceIdRequiredException);
		expect(catchError(() => resolveInstance(pair()))).toBeInstanceOf(InstanceResolutionException);
	});

	it('should expose the configured instances on the error without putting them in the message', () => {
		const error = catchError(() => resolveInstance(pair())) as InstanceIdRequiredException;

		expect(error.configuredInstanceIds).toEqual(['a', 'b']);
		expect(error.message).not.toContain('a, b');
	});

	it('should keep the unknown instanceId list off the message too', () => {
		const error = catchError(() => resolveInstance(pair(), 'nope')) as UnknownInstanceException;

		expect(error.instanceId).toBe('nope');
		expect(error.configuredInstanceIds).toEqual(['a', 'b']);
		expect(error.message).not.toContain('a, b');
	});
});
