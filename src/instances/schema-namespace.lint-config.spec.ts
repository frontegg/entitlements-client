import path from 'path';
import packageJson = require('../../package.json');
import eslintConfig = require('../../eslint.config.js');

const RULE = 'frontegg/require-namespaced-object-type';
const LINT_RULE_SOURCES = 'eslint-rules';

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

describe('lint coverage of the lint rule sources', () => {
	it('should lint the eslint-rules directory alongside the source tree', () => {
		expect(packageJson.scripts.lint).toContain(LINT_RULE_SOURCES);
		expect(packageJson.scripts['lint:fix']).toContain(LINT_RULE_SOURCES);
	});

	it('should prettier-check the eslint-rules directory alongside the source tree', () => {
		expect(packageJson.scripts.prettier).toContain(LINT_RULE_SOURCES);
		expect(packageJson.scripts['prettier:fix']).toContain(LINT_RULE_SOURCES);
	});

	it('should parse the eslint-rules directory as CommonJS so its requires and module exports resolve', () => {
		const entry = eslintConfig.find((candidate) => candidate.files?.includes('eslint-rules/**/*.js'));

		expect(entry?.languageOptions?.sourceType).toBe('commonjs');
	});
});
