import { RequestContext, RequestContextType, SubjectContext } from '@frontegg/e10s-client';
import { createClient, printHeader, printSummary } from './config';

const timSubject: SubjectContext = { entityType: 'user', key: 'Tim' };
const userSubject: SubjectContext = {
	tenantId: 'demo-tenant',
	userId: 'Tim'
};

const singleTests = [
	{
		name: 'January salary @ 2026-01-01',
		requestContext: {
			type: RequestContextType.Entity,
			entityType: 'document',
			key: "Tim's_salary_Jan",
			action: 'read_doc',
			at: '2026-01-01T00:00:00.000Z'
		}
	},
	{
		name: 'February salary @ 2026-01-01',
		requestContext: {
			type: RequestContextType.Entity,
			entityType: 'document',
			key: "Tim's_salary_feb",
			action: 'read_doc',
			at: '2026-01-01T00:00:00.000Z'
		}
	},
	{
		name: 'February salary @ 2026-02-01',
		requestContext: {
			type: RequestContextType.Entity,
			entityType: 'document',
			key: "Tim's_salary_feb",
			action: 'read_doc',
			at: '2026-02-01T00:00:00.000Z'
		}
	},
	{
		name: 'March salary @ 2026-03-01',
		requestContext: {
			type: RequestContextType.Entity,
			entityType: 'document',
			key: "Tim's_salary_mar",
			action: 'read_doc',
			at: '2026-03-01T00:00:00.000Z'
		}
	}
];

const batchTests = [
	{
		name: 'Entity batch',
		subjectContext: timSubject,
		requestContexts: singleTests.map((test) => test.requestContext),
		expected: [true, false, true, true]
	},
	{
		name: 'Feature batch',
		subjectContext: userSubject,
		requestContexts: [
			{ type: RequestContextType.Feature, featureKey: 'premium' },
			{ type: RequestContextType.Feature, featureKey: 'basic' },
			{ type: RequestContextType.Feature, featureKey: 'unknown-feature' }
		] as RequestContext[],
		expected: [true, true, false]
	}
];

function batchItemLabel(requestContext: RequestContext, index: number): string {
	if (requestContext.type === RequestContextType.Feature) {
		return `feature:${requestContext.featureKey}`;
	}
	if (requestContext.type === RequestContextType.Entity) {
		return `${requestContext.key} @ ${requestContext.at ?? 'now'}`;
	}
	return `[${index}] ${requestContext.type}`;
}

async function main(): Promise<void> {
	printHeader('🔐 Tim Entitlements Demo');
	console.log('\nRunning checks...\n');

	const client = createClient();

	const singleRows = [];
	for (const test of singleTests) {
		try {
			const result = await client.isEntitledTo(timSubject, test.requestContext);
			const entitled = result.result ?? false;
			singleRows.push({
				label: test.name,
				ok: entitled,
				detail: entitled ? 'ENTITLED' : 'NOT ENTITLED'
			});
		} catch (error) {
			singleRows.push({
				label: test.name,
				ok: false,
				detail: error instanceof Error ? error.message : String(error)
			});
		}
	}

	const batchRows = [];
	for (const test of batchTests) {
		try {
			const results = await client.isEntitledToMany(test.subjectContext, test.requestContexts);

			const passed = test.requestContexts.every((requestContext, index) => {
				const entitled = results[index]?.result ?? false;
				return entitled === test.expected[index];
			});

			batchRows.push({
				label: test.name,
				ok: passed,
				detail: passed ? 'all matched' : 'mismatch'
			});

			test.requestContexts.forEach((requestContext, index) => {
				const entitled = results[index]?.result ?? false;
				const expected = test.expected[index];
				const ok = entitled === expected;
				batchRows.push({
					label: `  ${batchItemLabel(requestContext, index)}`,
					ok,
					detail: ok
						? entitled
							? 'ENTITLED'
							: 'NOT ENTITLED'
						: `got ${entitled ? 'ENTITLED' : 'NOT ENTITLED'}`
				});
			});
		} catch (error) {
			batchRows.push({
				label: test.name,
				ok: false,
				detail: error instanceof Error ? error.message : String(error)
			});
		}
	}

	printSummary('isEntitledTo', singleRows);
	printSummary('isEntitledToMany', batchRows);
	console.log();
}

main();
