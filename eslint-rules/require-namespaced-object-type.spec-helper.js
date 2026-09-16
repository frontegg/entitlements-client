const path = require('path');
const { Linter, RuleTester } = require('eslint');
const parser = require('@typescript-eslint/parser');
const requireNamespacedObjectType = require('./require-namespaced-object-type');

const RULE_NAME = 'require-namespaced-object-type';
const FIXTURES_DIRECTORY = path.join(__dirname, 'fixtures');
const LINTED_SOURCE = path.join(FIXTURES_DIRECTORY, 'linted-source.ts');

function asLintedSource(testCase) {
	return { ...testCase, filename: LINTED_SOURCE };
}

function runRequireNamespacedObjectType({ valid, invalid }) {
	const ruleTester = new RuleTester({
		languageOptions: {
			parser,
			parserOptions: { project: './tsconfig.json', tsconfigRootDir: FIXTURES_DIRECTORY }
		}
	});

	ruleTester.run(RULE_NAME, requireNamespacedObjectType, {
		valid: valid.map(asLintedSource),
		invalid: invalid.map(asLintedSource)
	});
}

function lintWithoutTypeInformation(code) {
	return new Linter({ configType: 'flat' }).verify(
		code,
		[
			{
				files: ['**/*.ts'],
				languageOptions: { parser },
				plugins: { frontegg: { rules: { [RULE_NAME]: requireNamespacedObjectType } } },
				rules: { [`frontegg/${RULE_NAME}`]: 'error' }
			}
		],
		LINTED_SOURCE
	);
}

module.exports = { runRequireNamespacedObjectType, lintWithoutTypeInformation };
