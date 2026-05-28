import { SpiceDBEntitlementsClient, SimpleLoggingClient } from '@frontegg/e10s-client';

const config = {
	engineEndpoint: 'localhost:50051',
	engineToken: 'spicedb'
};

const lookupParams = {
	entityType: 'user',
	entityId: 'Tim',
	TargetEntityType: 'document',
	action: 'read_doc',
	limit: 50,
	cursor: undefined,
	//without at - now by default
	at: '2026-01-01T00:00:00Z'
	//at: '2026-02-01T00:00:00Z'
	// at: '2026-03-01T00:00:00Z'
};

async function main() {
	console.log('\n🔍 Lookup Target Entities Demo\n');
	console.log('━'.repeat(50));
	console.log('Configuration:');
	console.log(`  SpiceDB Endpoint: ${config.engineEndpoint}`);
	console.log(`  SpiceDB Token:    ${config.engineToken.substring(0, 8)}...`);
	console.log('━'.repeat(50));
	console.log('Lookup Parameters:');
	console.log(`  Entity Type:        ${lookupParams.entityType}`);
	console.log(`  Entity ID:          ${lookupParams.entityId}`);
	console.log(`  Target Entity Type: ${lookupParams.TargetEntityType}`);
	console.log(`  Action:             ${lookupParams.action}`);
	console.log(`  Limit:              ${lookupParams.limit}`);
	if (lookupParams.cursor) {
		console.log(`  Cursor:             ${lookupParams.cursor}`);
	}
	console.log('━'.repeat(50));
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

	try {
		console.log('📡 Executing lookupTargetEntities query...\n');

		const response = await client.lookupTargetEntities({
			...lookupParams
		});

		console.log('✅ Query successful!\n');
		console.log('━'.repeat(50));
		console.log('Results Summary:');
		console.log(`  Total Returned:   ${response.totalReturned}`);
		if (response.cursor) {
			console.log(`  Next Cursor:      ${response.cursor}`);
		}
		console.log('━'.repeat(50));

		if (response.targets.length > 0) {
			console.log('\nTarget Entities:');
			console.log('┌─────────────────────────────────────────────────┐');
			response.targets.forEach((target, index) => {
				console.log(
					`│ ${(index + 1).toString().padStart(3)}. ${target.TargetEntityType}:${target.TargetEntityId}`
				);
				if (target.permissionship) {
					console.log(`│      Permission: ${target.permissionship}`);
				}
			});
			console.log('└─────────────────────────────────────────────────┘');
		} else {
			console.log('\n📭 No target entities found matching the criteria.');
		}

		// If there's a cursor, show how to get more results
		if (response.cursor) {
			console.log('\n💡 Tip: To fetch the next page, run:');
			console.log(`   CURSOR="${response.cursor}" npm start`);
		}
	} catch (error) {
		console.error('❌ Error executing lookupTargetEntities:');
		if (error instanceof Error) {
			console.error(`   ${error.message}`);
			if (error.stack) {
				console.error('\nStack trace:');
				console.error(error.stack);
			}
		} else {
			console.error(error);
		}
		process.exit(1);
	}

	console.log('\n');
}

main();
