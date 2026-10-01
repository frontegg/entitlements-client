const path = require('path');
const { Linter, RuleTester } = require('eslint');
const parser = require('@typescript-eslint/parser');
const requireNamespacedObjectType = require('./require-namespaced-object-type');

const RULE_NAME = 'require-namespaced-object-type';
const FIXTURES_DIRECTORY = path.join(__dirname, 'fixtures');
const RULE_TESTER_ANCHOR = path.join(FIXTURES_DIRECTORY, 'rule-tester-anchor.ts');

function anchoredInFixtures(testCase) {
	return { ...testCase, filename: RULE_TESTER_ANCHOR };
}

function runRequireNamespacedObjectType({ valid, invalid }) {
	const ruleTester = new RuleTester({
		languageOptions: {
			parser,
			parserOptions: { project: './tsconfig.json', tsconfigRootDir: FIXTURES_DIRECTORY }
		}
	});

	ruleTester.run(RULE_NAME, requireNamespacedObjectType, {
		valid: valid.map(anchoredInFixtures),
		invalid: invalid.map(anchoredInFixtures)
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
		RULE_TESTER_ANCHOR
	);
}

module.exports = { RULE_TESTER_ANCHOR, runRequireNamespacedObjectType, lintWithoutTypeInformation };
