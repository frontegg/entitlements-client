import * as packageRoot from './index';
import * as exceptions from './exceptions';

const PUBLIC_EXCEPTIONS = [
	'CallerInputException',
	'ConfigurationInputIsInvalidException',
	'ConfigurationInputIsMissingException',
	'InstanceIdRequiredException',
	'InstanceResolutionException',
	'InvalidObjectTypeException',
	'UnknownInstanceException'
];

const exceptionNamesOf = (module: object): string[] =>
	Object.keys(module)
		.filter((name) => name.endsWith('Exception'))
		.sort();

describe('package root', () => {
	it('should export exactly the exceptions that are part of the contract', () => {
		expect(exceptionNamesOf(packageRoot)).toEqual(PUBLIC_EXCEPTIONS);
	});

	it('should name every published exception in the exceptions barrel', () => {
		expect(Object.keys(exceptions).sort()).toEqual(PUBLIC_EXCEPTIONS);
	});

	it('should export the same class the exceptions barrel names', () => {
		expect(Object.entries(packageRoot)).toEqual(expect.arrayContaining(Object.entries(exceptions)));
	});
});
