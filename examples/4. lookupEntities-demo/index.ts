import { SpiceDBEntitlementsClient, SimpleLoggingClient } from '@frontegg/e10s-client';

const config = {
	engineEndpoint: 'localhost:50051',
	engineToken: 'spicedb'
};

//
const lookupParams = {
	TargetEntityType: 'document',
	TargetEntityId: "Tim's_salary_feb",
	entityType: 'user',
	action: 'read_doc',
	//without at - now by default
	at: '2026-01-01T00:00:00Z' // no1
	// at: '2026-02-01T00:00:00Z' // both
};

async function main() {
	// Create the logging client
	const loggingClient = new SimpleLoggingClient();

	// Create the SpiceDB entitlements client
	const client = new SpiceDBEntitlementsClient(
		config,
		loggingClient,
		true, // logResults
		{ defaultFallback: false }
	);

	console.log('\n🔍 Lookup Entities Demo\n');
	console.log('━'.repeat(50));
	console.log('Configuration:');
	console.log(`  SpiceDB Endpoint: ${config.engineEndpoint}`);
	console.log(`  SpiceDB Token:    ${config.engineToken.substring(0, 8)}...`);
	console.log('━'.repeat(50));
	console.log('Lookup Parameters:');
	console.log(`  Target Entity Type: ${lookupParams.TargetEntityType}`);
	console.log(`  Target Entity ID:   ${lookupParams.TargetEntityId}`);
	console.log(`  Entity Type:        ${lookupParams.entityType}`);
	console.log(`  Action:             ${lookupParams.action}`);
	console.log('━'.repeat(50));
	console.log('\n');

	try {
		console.log('📡 Executing lookupEntities query...\n');

		const response = await client.lookupEntities({
			...lookupParams ///comment if not used
		});

		console.log('✅ Query successful!\n');
		console.log('━'.repeat(50));
		console.log('Results Summary:');
		console.log(`  Total Returned:   ${response.totalReturned}`);
		console.log('━'.repeat(50));

		if (response.entities.length > 0) {
			console.log('\nEntities:');
			console.log('┌─────────────────────────────────────────────────┐');
			response.entities.forEach((entity, index) => {
				console.log(`│ ${(index + 1).toString().padStart(3)}. ${entity.entityType}:${entity.entityId}`);
				if (entity.permissionship) {
					console.log(`│      Permission: ${entity.permissionship}`);
				}
			});
			console.log('└─────────────────────────────────────────────────┘');
		} else {
			console.log('\n📭 No entities found matching the criteria.');
		}
	} catch (error) {
		console.error('❌ Error executing lookupEntities:');
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
