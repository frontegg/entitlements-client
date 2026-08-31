import eslintConfig = require('../../eslint.config.js');

const RULE = 'frontegg/require-scoped-object-type';

interface FlatConfigEntry {
	files?: string[];
	ignores?: string[];
	rules?: Record<string, unknown>;
	plugins?: Record<string, { rules?: Record<string, unknown> }>;
	languageOptions?: { parserOptions?: { project?: string } };
}

describe('scope lint rule wiring', () => {
	const config = eslintConfig as unknown as FlatConfigEntry[];
	const entry = config.find((candidate) => candidate.rules?.[RULE] !== undefined);

	it('should enable the scoping rule as an error', () => {
		expect(entry).toBeDefined();
		expect(entry?.rules?.[RULE]).toBe('error');
	});

	it('should register the rule implementation behind the frontegg plugin', () => {
		expect(entry?.plugins?.frontegg?.rules?.['require-scoped-object-type']).toBeDefined();
	});

	it('should apply the rule across the source tree', () => {
		expect(entry?.files).toContain('src/**/*.ts');
	});

	it('should give the rule type information, without which it silently matches nothing', () => {
		expect(entry?.languageOptions?.parserOptions?.project).toBeDefined();
	});
});
