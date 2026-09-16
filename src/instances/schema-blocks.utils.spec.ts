import { filterSchemaBlocks } from './schema-blocks.utils';
import { SchemaParseException } from './schema-parse.exception';

const lines = (...parts: string[]): string => parts.join('\n');

describe(filterSchemaBlocks.name, () => {
	describe('isolation', () => {
		const schema = lines(
			'use expiration',
			'',
			'definition v_aaa/user {}',
			'',
			'definition v_bbb/secret {',
			'\trelation owner: v_bbb/user',
			'}',
			'',
			'caveat v_aaa/targeting(plan string) {',
			'\tplan == "pro"',
			'}',
			'',
			'caveat v_bbb/hidden(flag bool) {',
			'\tflag',
			'}',
			'',
			'definition v_aaa_b/lookalike {}'
		);

		it('should keep only the requested prefix blocks, not those of a look-alike prefix', () => {
			expect(filterSchemaBlocks(schema, 'v_aaa')).toBe(
				lines('definition user {}', '', 'caveat targeting(plan string) {', '\tplan == "pro"', '}')
			);
		});

		it('should keep only the other instance blocks when its prefix is requested', () => {
			expect(filterSchemaBlocks(schema, 'v_bbb')).toBe(
				lines(
					'definition secret {',
					'\trelation owner: user',
					'}',
					'',
					'caveat hidden(flag bool) {',
					'\tflag',
					'}'
				)
			);
		});

		it('should return nothing when no block belongs to the prefix', () => {
			expect(filterSchemaBlocks(schema, 'v_ccc')).toBe('');
		});
	});

	describe('block boundaries', () => {
		it('should keep nested braces inside a caveat expression', () => {
			const schema = lines(
				'caveat v_aaa/allowed(plan string) {',
				'\t{"pro": true, "free": false}[plan]',
				'}',
				'definition v_bbb/secret {}'
			);

			expect(filterSchemaBlocks(schema, 'v_aaa')).toBe(
				lines('caveat allowed(plan string) {', '\t{"pro": true, "free": false}[plan]', '}')
			);
		});

		it('should ignore braces and headers inside comments spanning lines', () => {
			const schema = lines(
				'definition v_aaa/user {',
				'\t/* closing } here',
				'\tdefinition v_bbb/leak {',
				'\t*/',
				'\t// another } and {',
				'\trelation self: v_aaa/user',
				'}',
				'definition v_bbb/secret {}'
			);

			expect(filterSchemaBlocks(schema, 'v_aaa')).toBe(
				lines(
					'definition user {',
					'\t/* closing } here',
					'\tdefinition v_bbb/leak {',
					'\t*/',
					'\t// another } and {',
					'\trelation self: user',
					'}'
				)
			);
		});

		it('should ignore braces and headers inside a multi-line string', () => {
			const schema = lines(
				'caveat v_aaa/banner(text string) {',
				'\ttext == """}',
				'definition v_bbb/leak {"""',
				'}',
				'definition v_bbb/secret {}'
			);

			expect(filterSchemaBlocks(schema, 'v_aaa')).toBe(
				lines('caveat banner(text string) {', '\ttext == """}', 'definition v_bbb/leak {"""', '}')
			);
		});

		it.each([
			['a double-quoted string with an escaped quote', '\tx == "\\"}"'],
			['a single-quoted string', "\tx == '}'"],
			['a raw string ending in a backslash', "\tx == r'\\' || x == '}'"],
			['a backtick string spanning lines', '\tx == `}\n{`'],
			['a triple single-quoted string spanning lines', "\tx == '''}\n'''"]
		])('should ignore braces inside %s', (_label, body) => {
			const schema = lines('caveat v_aaa/c(x string) {', body, '}', 'definition v_bbb/secret {}');

			expect(filterSchemaBlocks(schema, 'v_aaa')).toBe(lines('caveat c(x string) {', body, '}'));
		});
	});

	describe('fail closed', () => {
		it.each([
			[
				'a block left open before the next header',
				lines('definition v_aaa/user {', '\trelation viewer: v_aaa/user', 'definition v_bbb/secret {}'),
				"'definition' starts before the previous block is closed at line 3"
			],
			[
				'a header without a body',
				lines('caveat v_aaa/c(x int)', 'definition v_bbb/secret {}'),
				"'definition' starts before the previous block is closed at line 2"
			],
			[
				'a block left open at the end of the schema',
				lines('definition v_bbb/secret {}', 'definition v_aaa/user {'),
				'Unclosed block at end of schema at line 2'
			],
			['a stray closing brace', lines('definition v_aaa/user {}', '}'), "Unbalanced '}' at line 2"],
			[
				'an unterminated string',
				lines('caveat v_aaa/c(x string) {', '\tx == "}', '}'),
				'Unterminated string at line 2'
			],
			[
				'an unterminated block comment',
				lines('definition v_aaa/user {', '\t/* }', '}'),
				'Unterminated block comment at line 2'
			]
		])('should throw on %s', (_label, schema, message) => {
			expect(() => filterSchemaBlocks(schema, 'v_aaa')).toThrow(SchemaParseException);
			expect(() => filterSchemaBlocks(schema, 'v_aaa')).toThrow(message);
		});
	});

	describe('prefix stripping', () => {
		it('should strip the prefix from definition and caveat names, subject types and caveat references', () => {
			const schema = lines(
				'definition v_aaa/user {}',
				'definition v_aaa/document {',
				'\trelation viewer: v_aaa/user | v_aaa/group#member | v_aaa/user:* with v_aaa/targeting',
				'\tpermission view = viewer + parent->view',
				'}',
				'caveat v_aaa/targeting(plan string) {',
				'\tplan == "pro"',
				'}'
			);

			expect(filterSchemaBlocks(schema, 'v_aaa')).toBe(
				lines(
					'definition user {}',
					'',
					'definition document {',
					'\trelation viewer: user | group#member | user:* with targeting',
					'\tpermission view = viewer + parent->view',
					'}',
					'',
					'caveat targeting(plan string) {',
					'\tplan == "pro"',
					'}'
				)
			);
		});

		it('should leave a foreign prefix, a look-alike identifier and string contents untouched', () => {
			const schema = lines(
				'definition v_aaa/document {',
				'\trelation owner: v_bbb/user | xv_aaa/user',
				'}',
				'caveat v_aaa/named(name string) {',
				'\tname == "v_aaa/user"',
				'}'
			);

			expect(filterSchemaBlocks(schema, 'v_aaa')).toBe(
				lines(
					'definition document {',
					'\trelation owner: v_bbb/user | xv_aaa/user',
					'}',
					'',
					'caveat named(name string) {',
					'\tname == "v_aaa/user"',
					'}'
				)
			);
		});
	});
});

describe('a keyword that is really a field access', () => {
	const schema = [
		'definition v_aaa/user {}',
		'caveat v_aaa/c(attrs map<any>) {',
		'  attrs.definition == 1',
		'}',
		'definition v_bbb/secret {}'
	].join('\n');

	it('should not read attrs.definition as the start of a block', () => {
		const filtered = filterSchemaBlocks(schema, 'v_aaa');

		expect(filtered).toContain('attrs.definition == 1');
		expect(filtered).not.toContain('v_bbb');
	});

	it('should still read a real definition that follows a caveat body', () => {
		expect(filterSchemaBlocks(schema, 'v_bbb')).toBe('definition secret {}');
	});
});
