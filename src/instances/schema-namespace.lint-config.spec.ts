import path from 'path';
import eslintConfig = require('../../eslint.config.js');

const RULE = 'frontegg/require-namespaced-object-type';

describe('namespace lint rule wiring', () => {
	const entry = eslintConfig.find((candidate) => candidate.rules?.[RULE] !== undefined);

	it('should enable the namespacing rule as an error', () => {
		expect(entry).toBeDefined();
		expect(entry?.rules?.[RULE]).toBe('error');
	});

	it('should register the rule implementation behind the frontegg plugin', () => {
		expect(entry?.plugins?.frontegg?.rules?.['require-namespaced-object-type']).toBeDefined();
	});

	it('should apply the rule across the source tree', () => {
		expect(entry?.files).toContain('src/**/*.ts');
	});

	it('should give the rule type information rooted at the repository', () => {
		expect(entry?.languageOptions?.parserOptions?.project).toBe('./tsconfig.json');
		expect(entry?.languageOptions?.parserOptions?.tsconfigRootDir).toBe(path.join(__dirname, '..', '..'));
	});
});
