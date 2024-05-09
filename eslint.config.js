const parser = require('@typescript-eslint/parser');
const eslintPlugin = require('@typescript-eslint/eslint-plugin');
const tseslint = require('typescript-eslint');
const eslint = require('@eslint/js');

module.exports = tseslint.config(
        eslint.configs.recommended,
        ...tseslint.configs.recommended,
        {
            languageOptions: {
                parser,
                parserOptions: {
                    sourceType: 'module',
                },
            },
            plugins: {'@typescript-eslint/eslint-plugin': eslintPlugin}, // extends: [
            //     'plugin:@typescript-eslint/eslint-recommended',
            //     'plugin:@typescript-eslint/recommended',
            //     'prettier',
            // ],
            // root: true,
            // env: {
            //     node: true,
            //     jest: true,
            // },
            // files: ['src/**/*.ts'],
            // ignores: ["dist/", "coverage/", "test-results/", "node_modules/","eslint.config.js"],
            rules: {
                '@typescript-eslint/interface-name-prefix': 'off',
                '@typescript-eslint/explicit-function-return-type': 'error',
                '@typescript-eslint/no-explicit-any': 'warn',
                '@typescript-eslint/no-inferrable-types': 'off',
                '@typescript-eslint/no-var-requires': 'warn',
                semi: 'off',
                '@typescript-eslint/semi': ['error'],
                '@typescript-eslint/quotes': [
                    'error',
                    'single',
                    {avoidEscape: true, allowTemplateLiterals: true},
                ],
                '@typescript-eslint/no-unused-vars': ['warn', {args: 'none'}],
            },
        },
);
