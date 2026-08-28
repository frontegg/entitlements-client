import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const SRC_ROOT = join(__dirname, '..');

const OBJECT_TYPE_FIELD = /\b(objectType|resourceObjectType|subjectObjectType|resourceType):\s*([^\n,]+)/g;

const REQUEST_SPAN_START =
	/v1\.[A-Za-z]+\.create\(|createBulkPermissionRequestItem\([\s\S]*?\)\s*:\s*v1\.CheckBulkPermissionsRequestItem\s*\{/g;

function collectSources(dir: string, acc: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			collectSources(full, acc);
		} else if (entry.endsWith('.ts') && !entry.includes('.spec')) {
			acc.push(full);
		}
	}
	return acc;
}

function requestSpans(source: string): [number, number][] {
	const spans: [number, number][] = [];
	REQUEST_SPAN_START.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = REQUEST_SPAN_START.exec(source)) !== null) {
		let depth = 1;
		let index = match.index + match[0].length;
		while (index < source.length && depth > 0) {
			const char = source[index];
			if (char === '(' || char === '{') depth++;
			else if (char === ')' || char === '}') depth--;
			index++;
		}
		spans.push([match.index, index]);
	}
	return spans;
}

describe('schema scope guard', () => {
	const sources = collectSources(SRC_ROOT);

	it('should find the sources it is guarding', () => {
		expect(sources.length).toBeGreaterThan(10);
	});

	it('should build every SpiceDB request object type through scope.type()', () => {
		const offenders: string[] = [];

		for (const file of sources) {
			const relative = file.slice(SRC_ROOT.length + 1);
			const source = readFileSync(file, 'utf8');
			const spans = requestSpans(source);

			OBJECT_TYPE_FIELD.lastIndex = 0;
			let match: RegExpExecArray | null;
			while ((match = OBJECT_TYPE_FIELD.exec(source)) !== null) {
				const position = match.index;
				if (!spans.some(([start, end]) => position >= start && position < end)) {
					continue;
				}

				const value = match[2].trim();
				if (value.startsWith('scope.type(') || value === 'string') {
					continue;
				}

				const line = source.slice(0, position).split('\n').length;
				offenders.push(`${relative}:${line}  ${match[0].trim()}`);
			}
		}

		expect(offenders).toEqual([]);
	});
});
