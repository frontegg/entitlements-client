import { SpiceDBEntitlementsClient, SimpleLoggingClient, RequestContextType } from '@frontegg/e10s-client';

const config = {
	engineEndpoint: 'localhost:50051',
	engineToken: 'spicedb'
};

// Example subject context - adjust these values based on your SpiceDB schema
const subjectContext = {
	entityType: 'user',
	key: 'Alice'
};

// Different types of entitlement checks to test
const testCases = [
	{
		name: "Alice can read Tim's salary",
		requestContext: {
			type: RequestContextType.Entity as const,
			entityType: 'document',
			key: "Tim's_salary_Jan",
			action: 'read_doc',
			at: '2026-02-01T00:00:00.000Z'
		}
	}
];

async function main() {
	console.log('\n🔐 Is Entitled Demo\n');
	console.log('━'.repeat(60));
	console.log('Configuration:');
	console.log(`  SpiceDB Endpoint: ${config.engineEndpoint}`);
	console.log(`  SpiceDB Token:    ${config.engineToken.substring(0, 8)}...`);
	console.log('━'.repeat(60));
	console.log('Subject Context:');
	console.log(`  Entity Type:      ${subjectContext.entityType}`);
	console.log(`  Key:              ${subjectContext.key}`);
	console.log('━'.repeat(60));
	console.log('\n');

	// Create the logging client
	const loggingClient = new SimpleLoggingClient();

	// Create the SpiceDB entitlements client
	const client = new SpiceDBEntitlementsClient(
		config,
		loggingClient,
		true, // logResults
		{ defaultFallback: false }
	);

	console.log('📡 Running entitlement checks...\n');

	const results: Array<{ name: string; entitled: boolean; context: object }> = [];

	for (const testCase of testCases) {
		try {
			console.log(`\n🔍 Testing: ${testCase.name}`);
			console.log(`   Context: ${JSON.stringify(testCase.requestContext, null, 2).replace(/\n/g, '\n   ')}`);

			const result = await client.isEntitledTo(subjectContext, testCase.requestContext);

			const entitled = result.result ?? false;
			results.push({
				name: testCase.name,
				entitled,
				context: testCase.requestContext
			});

			if (entitled) {
				console.log(`   ✅ Result: ENTITLED`);
			} else {
				console.log(`   ❌ Result: NOT ENTITLED`);
			}

			if (result.monitoring) {
				console.log(`   ℹ️  Monitoring mode: true`);
			}
		} catch (error) {
			console.error(`   ⚠️  Error: ${error instanceof Error ? error.message : String(error)}`);
			results.push({
				name: testCase.name,
				entitled: false,
				context: testCase.requestContext
			});
		}
	}

	// Summary
	console.log('\n');
	console.log('━'.repeat(60));
	console.log('Summary:');
	console.log('━'.repeat(60));

	for (const result of results) {
		const checkName = result.name.padEnd(30);
		const status = result.entitled ? '✅ Entitled' : '❌ Denied  ';
		console.log(` ${checkName} │ ${status} `);
	}

	const entitledCount = results.filter((r) => r.entitled).length;
	console.log(`\nTotal: ${entitledCount}/${results.length} checks passed`);
	console.log('\n');
}

main();
