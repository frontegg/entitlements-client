import { filterSchemaBlocks } from './schema-blocks.utils';
import { SchemaParseException } from '../exceptions/schema-parse.exception';
import { ConfigurationInputIsInvalidException } from '../exceptions/configuration-input-is-invalid.exception';

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
			expect(filterSchemaBlocks(schema, { kind: 'prefixed', prefix: 'v_aaa' })).toBe(
				lines('definition user {}', '', 'caveat targeting(plan string) {', '\tplan == "pro"', '}')
			);
		});

		it('should keep only the other instance blocks when its prefix is requested', () => {
			expect(filterSchemaBlocks(schema, { kind: 'prefixed', prefix: 'v_bbb' })).toBe(
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
			expect(filterSchemaBlocks(schema, { kind: 'prefixed', prefix: 'v_ccc' })).toBe('');
		});
	});

	describe('unprefixed ownership', () => {
		const schema = lines(
			'use expiration',
			'',
			'definition user {}',
			'',
			'definition v_aaa/secret {',
			'\trelation owner: v_aaa/user',
			'}',
			'',
			'caveat targeting(plan string) {',
			'\tplan == "pro"',
			'}',
			'',
			'caveat v_bbb/hidden(flag bool) {',
			'\tflag',
			'}',
			'',
			'definition acme/document {}',
			'',
			'definition document {',
			'\trelation viewer: user',
			'}'
		);

		it('should keep only the blocks whose name has no prefix, unchanged', () => {
			expect(filterSchemaBlocks(schema, { kind: 'unprefixed' })).toBe(
				lines(
					'definition user {}',
					'',
					'caveat targeting(plan string) {',
					'\tplan == "pro"',
					'}',
					'',
					'definition document {',
					'\trelation viewer: user',
					'}'
				)
			);
		});

		it('should fail closed on a schema it cannot split', () => {
			expect(() =>
				filterSchemaBlocks(lines('definition user {', 'definition v_aaa/secret {}'), { kind: 'unprefixed' })
			).toThrow(SchemaParseException);
		});
	});

	describe('empty prefix', () => {
		it('should refuse an empty prefix instead of returning no blocks', () => {
			const filter = (): string => filterSchemaBlocks('definition user {}', { kind: 'prefixed', prefix: '' });

			expect(filter).toThrow(ConfigurationInputIsInvalidException);
			expect(filter).toThrow(
				'Schema prefix must not be empty; filter the legacy instance by unprefixed ownership'
			);
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

			expect(filterSchemaBlocks(schema, { kind: 'prefixed', prefix: 'v_aaa' })).toBe(
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

			expect(filterSchemaBlocks(schema, { kind: 'prefixed', prefix: 'v_aaa' })).toBe(
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

			expect(filterSchemaBlocks(schema, { kind: 'prefixed', prefix: 'v_aaa' })).toBe(
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

			expect(filterSchemaBlocks(schema, { kind: 'prefixed', prefix: 'v_aaa' })).toBe(
				lines('caveat c(x string) {', body, '}')
			);
		});
	});

	describe('fail closed', () => {
		it.each([
			[
				'a block left open before the next header',
				lines('definition v_aaa/user {', '\trelation viewer: v_aaa/user', 'definition v_bbb/secret {}'),
				'Unclosed block at end of schema at line 3'
			],
			[
				'a header without a body',
				lines('caveat v_aaa/c(x int)', 'definition v_bbb/secret {}'),
				"Expected '{' at line 2"
			],
			[
				'a statement other than a definition, a caveat or a use',
				lines('definition v_aaa/user {}', 'relation viewer: v_aaa/user'),
				'Expected a definition or a caveat at line 2'
			],
			[
				'a use directive after a block',
				lines('definition v_aaa/user {}', 'use expiration'),
				'Expected a definition or a caveat at line 2'
			],
			[
				'a string at the top level',
				lines('definition v_aaa/user {}', '"definition v_bbb/secret {}"'),
				'Expected a definition or a caveat at line 2'
			],
			['a keyword prefix of a word', 'definitions v_aaa/user {}', 'Expected a definition or a caveat at line 1'],
			['a definition without a name', 'definition {}', "'definition' has no name at line 1"],
			['a name with a trailing separator', 'definition v_aaa/ {}', "Expected '{' at line 1"],
			['a caveat without parameters', 'caveat v_aaa/c { true }', "Expected '(' at line 1"],
			[
				'a mismatched closer',
				lines('caveat v_aaa/c(x int) {', '\t(x }', 'definition v_bbb/secret {}'),
				"Unbalanced '}' at line 2"
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
			expect(() => filterSchemaBlocks(schema, { kind: 'prefixed', prefix: 'v_aaa' })).toThrow(
				SchemaParseException
			);
			expect(() => filterSchemaBlocks(schema, { kind: 'prefixed', prefix: 'v_aaa' })).toThrow(message);
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

			expect(filterSchemaBlocks(schema, { kind: 'prefixed', prefix: 'v_aaa' })).toBe(
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

			expect(filterSchemaBlocks(schema, { kind: 'prefixed', prefix: 'v_aaa' })).toBe(
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
		const filtered = filterSchemaBlocks(schema, { kind: 'prefixed', prefix: 'v_aaa' });

		expect(filtered).toContain('attrs.definition == 1');
		expect(filtered).not.toContain('v_bbb');
	});

	it('should still read a real definition that follows a caveat body', () => {
		expect(filterSchemaBlocks(schema, { kind: 'prefixed', prefix: 'v_bbb' })).toBe('definition secret {}');
	});
});

describe('a comment between the keyword and the name', () => {
	const schema = ['definition /* own */ v_aaa/user {}', 'definition // next', 'v_bbb/secret {}'].join('\n');

	it('should read the name past a block comment rather than dropping the block', () => {
		const filtered = filterSchemaBlocks(schema, { kind: 'prefixed', prefix: 'v_aaa' });

		expect(filtered).toContain('user');
		expect(filtered).not.toContain('v_bbb');
	});

	it('should read the name past a line comment', () => {
		expect(filterSchemaBlocks(schema, { kind: 'prefixed', prefix: 'v_bbb' })).toContain('secret');
	});
});

describe('a keyword where SpiceDB reads an identifier', () => {
	describe.each([
		['prefixed', 'v_aaa/', { kind: 'prefixed', prefix: 'v_aaa' } as const],
		['unprefixed', '', { kind: 'unprefixed' } as const]
	])('with %s ownership', (_ownershipLabel, prefix, ownership) => {
		it.each([
			['a CEL comprehension variable named definition', '\titems.exists(definition, definition > 1)'],
			['a CEL comprehension variable named caveat', '\titems.all(caveat, caveat < 9)'],
			['a field named definition selected after whitespace', '\tattrs. definition == 1'],
			['a field named caveat', '\tattrs.caveat == 1'],
			['a string holding a header', '\tattrs.name == "} definition v_bbb/leak {"'],
			['a comment holding a header', '\t/* } caveat v_bbb/leak(definition int) { */ true']
		])('should keep a caveat whose body has %s', (_label, body) => {
			const schema = lines(
				'use expiration',
				`caveat ${prefix}c(items list<int>, attrs map<any>) {`,
				body,
				'}',
				'definition v_bbb/secret {}'
			);

			expect(filterSchemaBlocks(schema, ownership)).toBe(
				lines('caveat c(items list<int>, attrs map<any>) {', body, '}')
			);
		});

		it.each([
			['a line comment holding a header', '\t// definition v_bbb/leak {'],
			['a block comment holding a header', '\t/* } caveat v_bbb/leak(definition int) { */']
		])('should keep a definition whose body has %s', (_label, body) => {
			const schema = lines(
				`definition ${prefix}user {}`,
				`definition ${prefix}document {`,
				body,
				`\trelation viewer: ${prefix}user`,
				'}',
				'definition v_bbb/secret {}'
			);

			expect(filterSchemaBlocks(schema, ownership)).toBe(
				lines('definition user {}', '', 'definition document {', body, '\trelation viewer: user', '}')
			);
		});

		it('should keep the requested blocks when another instance uses the keywords as identifiers', () => {
			const schema = lines(
				`definition ${prefix}user {}`,
				'caveat v_bbb/ranked(items list<int>) {',
				'\titems.exists(definition, definition > 1) && items.all(caveat, caveat < 9)',
				'}'
			);

			expect(filterSchemaBlocks(schema, ownership)).toBe('definition user {}');
		});
	});
});
