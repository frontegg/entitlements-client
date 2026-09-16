import { SchemaParseException } from './schema-parse.exception';
import {
	FIELD_ACCESSOR,
	SCHEMA_HEADER_KEYWORDS,
	SCHEMA_RAW_STRING_PREFIXES,
	SCHEMA_STRING_DELIMITERS
} from './instance.constants';

const isIdentifierChar = (char: string | undefined): boolean =>
	char !== undefined &&
	((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9') || char === '_');

const isWhitespace = (char: string | undefined): boolean =>
	char === ' ' || char === '\t' || char === '\n' || char === '\r';

const isIdentifierStart = (text: string, index: number): boolean =>
	!isIdentifierChar(text[index - 1]) && text[index - 1] !== '/' && text[index - 1] !== FIELD_ACCESSOR;

const lineAt = (text: string, index: number): number => text.slice(0, index).split('\n').length;

function headerKeywordAt(text: string, index: number): string | undefined {
	if (!isIdentifierStart(text, index)) {
		return undefined;
	}

	return SCHEMA_HEADER_KEYWORDS.find(
		(keyword) => text.startsWith(keyword, index) && isWhitespace(text[index + keyword.length])
	);
}

function blockNameAfter(text: string, index: number): string {
	let start = index;
	while (isWhitespace(text[start])) {
		start += 1;
	}

	let end = start;
	while (isIdentifierChar(text[end]) || text[end] === '/') {
		end += 1;
	}

	return text.slice(start, end);
}

function isRawString(text: string, index: number, delimiter: string): boolean {
	if (delimiter === '`') {
		return true;
	}

	let start = index;
	while (isIdentifierChar(text[start - 1])) {
		start -= 1;
	}

	return SCHEMA_RAW_STRING_PREFIXES.includes(text.slice(start, index).toLowerCase());
}

function endOfString(text: string, index: number, delimiter: string): number {
	const isRaw = isRawString(text, index, delimiter);
	let cursor = index + delimiter.length;

	while (cursor < text.length) {
		if (!isRaw && text[cursor] === '\\') {
			cursor += 2;
		} else if (text.startsWith(delimiter, cursor)) {
			return cursor + delimiter.length;
		} else {
			cursor += 1;
		}
	}

	throw new SchemaParseException(lineAt(text, index), 'Unterminated string');
}

function endOfComment(text: string, index: number): number {
	if (text.startsWith('//', index)) {
		const newline = text.indexOf('\n', index);
		return newline === -1 ? text.length : newline;
	}

	const close = text.indexOf('*/', index + 2);
	if (close === -1) {
		throw new SchemaParseException(lineAt(text, index), 'Unterminated block comment');
	}

	return close + 2;
}

function withoutMarkers(text: string, [start, end]: [number, number], markers: number[], markerLength: number): string {
	let result = '';
	let cursor = start;

	for (const marker of markers) {
		if (marker >= start && marker < end) {
			result += text.slice(cursor, marker);
			cursor = marker + markerLength;
		}
	}

	return result + text.slice(cursor, end);
}

export function filterSchemaBlocks(schemaText: string, prefix: string): string {
	const marker = `${prefix}/`;
	const ownBlocks: [number, number][] = [];
	const markers: number[] = [];
	let depth = 0;
	let blockStart: number | undefined;
	let isOwnBlock = false;
	let index = 0;

	while (index < schemaText.length) {
		const char = schemaText[index];

		if (schemaText.startsWith('//', index) || schemaText.startsWith('/*', index)) {
			index = endOfComment(schemaText, index);
			continue;
		}

		const delimiter = SCHEMA_STRING_DELIMITERS.find((candidate) => schemaText.startsWith(candidate, index));
		if (delimiter) {
			index = endOfString(schemaText, index, delimiter);
			continue;
		}

		if (char === '{') {
			depth += 1;
			index += 1;
			continue;
		}

		if (char === '}') {
			depth -= 1;
			if (depth < 0) {
				throw new SchemaParseException(lineAt(schemaText, index), "Unbalanced '}'");
			}
			index += 1;
			if (depth === 0 && blockStart !== undefined) {
				if (isOwnBlock) {
					ownBlocks.push([blockStart, index]);
				}
				blockStart = undefined;
			}
			continue;
		}

		const keyword = headerKeywordAt(schemaText, index);
		if (keyword) {
			if (depth > 0 || blockStart !== undefined) {
				throw new SchemaParseException(
					lineAt(schemaText, index),
					`'${keyword}' starts before the previous block is closed`
				);
			}
			blockStart = index;
			isOwnBlock = blockNameAfter(schemaText, index + keyword.length).startsWith(marker);
			index += keyword.length;
			continue;
		}

		if (isIdentifierStart(schemaText, index) && schemaText.startsWith(marker, index)) {
			markers.push(index);
			index += marker.length;
			continue;
		}

		index += 1;
	}

	if (depth !== 0 || blockStart !== undefined) {
		throw new SchemaParseException(lineAt(schemaText, schemaText.length), 'Unclosed block at end of schema');
	}

	return ownBlocks.map((span) => withoutMarkers(schemaText, span, markers, marker.length)).join('\n\n');
}
