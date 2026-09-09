import { EntitlementsClientFactory } from '../entitlements-client-factory';
import { SpiceDBEntitlementsClient } from './spicedb-entitlements.client';

const build = (schemaText: string): SpiceDBEntitlementsClient => {
	const client = EntitlementsClientFactory.create({
		engineEndpoint: '127.0.0.1:1',
		engineToken: 't',
		instances: [
			{ instanceId: 'a', vendorId: 'va', schemaPrefix: 'v_aaa' },
			{ instanceId: 'b', vendorId: 'vb', schemaPrefix: 'v_bbb' }
		]
	});
	(client as unknown as { spiceClient: { readSchema: () => Promise<{ schemaText: string }> } }).spiceClient = {
		readSchema: () => Promise.resolve({ schemaText })
	} as never;
	return client;
};

describe('readSchemaFor block splitting', () => {
	it.each([
		[
			'brace in a double-quoted caveat string',
			'definition v_aaa/user {}\ncaveat v_aaa/c(x string) {\n  x == "{"\n}\ndefinition v_bbb/secret {}\n'
		],
		[
			'brace in a single-quoted string',
			"definition v_aaa/user {}\ncaveat v_aaa/c(x string) {\n  x == '{'\n}\ndefinition v_bbb/secret {}\n"
		],
		['brace in a line comment', 'definition v_aaa/user {\n  // stray { here\n}\ndefinition v_bbb/secret {}\n'],
		[
			'brace in a block comment',
			'definition v_aaa/user {\n  /* stray { spanning\n     lines { */\n}\ndefinition v_bbb/secret {}\n'
		],
		[
			'escaped quote then brace',
			'definition v_aaa/user {}\ncaveat v_aaa/c(x string) {\n  x == "\\"{"\n}\ndefinition v_bbb/secret {}\n'
		]
	])('should not leak v_bbb for: %s', async (_label, schema) => {
		const out = await build(schema).readSchemaFor('a');
		expect(out).not.toContain('v_bbb');
		expect(out).toContain('v_aaa/user');
	});

	it('should still return the instance own caveat body intact', async () => {
		const schema =
			'definition v_aaa/user {}\ncaveat v_aaa/c(x string) {\n  x == "{"\n}\ndefinition v_bbb/secret {}\n';
		const out = await build(schema).readSchemaFor('a');
		expect(out).toContain('caveat v_aaa/c');
		expect(out).toContain('x == "{"');
	});
});
