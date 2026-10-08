import { ConfigurationInputIsInvalidException } from '../exceptions/configuration-input-is-invalid.exception';
import { SchemaParseException } from '../exceptions/schema-parse.exception';
import {
	FIELD_ACCESSOR,
	SCHEMA_CLOSER_BY_OPENER,
	SCHEMA_GROUP_OPENERS_BY_HEADER_KEYWORD,
	SCHEMA_RAW_STRING_PREFIXES,
	SCHEMA_STATEMENT_TERMINATOR,
	SCHEMA_STRING_DELIMITERS,
	SCHEMA_USE_KEYWORD,
	TYPE_PATH_SEPARATOR
} from './instance.constants';
import { SchemaBlockOwnership } from './instance.types';

const SCHEMA_CLOSERS = [...SCHEMA_CLOSER_BY_OPENER.values()];

const isIdentifierChar = (char: string | undefined): boolean =>
	char !== undefined &&
	((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9') || char === '_');

const isWhitespace = (char: string | undefined): boolean =>
	char === ' ' || char === '\t' || char === '\n' || char === '\r';

const isIdentifierStart = (text: string, index: number): boolean =>
	!isIdentifierChar(text[index - 1]) && text[index - 1] !== '/' && text[index - 1] !== FIELD_ACCESSOR;

const isCommentStart = (text: string, index: number): boolean =>
	text.startsWith('//', index) || text.startsWith('/*', index);

const lineAt = (text: string, index: number): number => text.slice(0, index).split('\n').length;

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

function endOfTrivia(text: string, index: number): number {
	let cursor = index;
	for (;;) {
		if (isWhitespace(text[cursor])) {
			cursor += 1;
		} else if (isCommentStart(text, cursor)) {
			cursor = endOfComment(text, cursor);
		} else {
			return cursor;
		}
	}
}

function endOfWord(text: string, index: number): number {
	let end = index;
	while (isIdentifierChar(text[end])) {
		end += 1;
	}

	return end;
}

function endOfName(text: string, index: number): number {
	let end = endOfWord(text, index);
	while (end > index && text[end] === TYPE_PATH_SEPARATOR && isIdentifierChar(text[end + 1])) {
		end = endOfWord(text, end + 1);
	}

	return end;
}

function endOfGroup(
	text: string,
	index: number,
	opener: string,
	marker: string | undefined,
	markers: number[]
): number {
	if (text[index] !== opener) {
		throw new SchemaParseException(lineAt(text, index), `Expected '${opener}'`);
	}

	const expectedClosers: string[] = [];
	let cursor = index;

	while (cursor < text.length) {
		const char = text[cursor];

		if (isCommentStart(text, cursor)) {
			cursor = endOfComment(text, cursor);
			continue;
		}

		const delimiter = SCHEMA_STRING_DELIMITERS.find((candidate) => text.startsWith(candidate, cursor));
		if (delimiter) {
			cursor = endOfString(text, cursor, delimiter);
			continue;
		}

		const closer = SCHEMA_CLOSER_BY_OPENER.get(char);
		if (closer !== undefined) {
			expectedClosers.push(closer);
			cursor += 1;
			continue;
		}

		if (SCHEMA_CLOSERS.includes(char)) {
			if (expectedClosers.pop() !== char) {
				throw new SchemaParseException(lineAt(text, cursor), `Unbalanced '${char}'`);
			}
			cursor += 1;
			if (expectedClosers.length === 0) {
				return cursor;
			}
			continue;
		}

		if (marker !== undefined && isIdentifierStart(text, cursor) && text.startsWith(marker, cursor)) {
			markers.push(cursor);
			cursor += marker.length;
			continue;
		}

		cursor += 1;
	}

	throw new SchemaParseException(lineAt(text, text.length), 'Unclosed block at end of schema');
}

function topLevelError(text: string, index: number): SchemaParseException {
	const char = text[index];
	const problem = SCHEMA_CLOSERS.includes(char) ? `Unbalanced '${char}'` : 'Expected a definition or a caveat';

	return new SchemaParseException(lineAt(text, index), problem);
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

function markerFor(ownership: SchemaBlockOwnership): string | undefined {
	if (ownership.kind === 'unprefixed') {
		return undefined;
	}

	if (ownership.prefix === '') {
		throw new ConfigurationInputIsInvalidException(
			'Schema prefix must not be empty; filter the legacy instance by unprefixed ownership'
		);
	}

	return `${ownership.prefix}/`;
}

const isOwnBlockName = (name: string, marker: string | undefined): boolean =>
	marker === undefined ? !name.includes('/') : name.startsWith(marker);

export function filterSchemaBlocks(schemaText: string, ownership: SchemaBlockOwnership): string {
	const marker = markerFor(ownership);
	const ownBlocks: [number, number][] = [];
	const markers: number[] = [];
	let hasBlock = false;
	let index = endOfTrivia(schemaText, 0);

	while (index < schemaText.length) {
		if (schemaText[index] === SCHEMA_STATEMENT_TERMINATOR) {
			index = endOfTrivia(schemaText, index + 1);
			continue;
		}

		const keyword = schemaText.slice(index, endOfWord(schemaText, index));
		if (keyword === SCHEMA_USE_KEYWORD && !hasBlock) {
			const flagStart = endOfTrivia(schemaText, index + keyword.length);
			index = endOfTrivia(schemaText, endOfWord(schemaText, flagStart));
			continue;
		}

		const openers = SCHEMA_GROUP_OPENERS_BY_HEADER_KEYWORD.get(keyword);
		if (openers === undefined) {
			throw topLevelError(schemaText, index);
		}

		const nameStart = endOfTrivia(schemaText, index + keyword.length);
		const nameEnd = endOfName(schemaText, nameStart);
		if (nameEnd === nameStart) {
			throw new SchemaParseException(lineAt(schemaText, nameStart), `'${keyword}' has no name`);
		}
		if (marker !== undefined && schemaText.startsWith(marker, nameStart)) {
			markers.push(nameStart);
		}

		const blockEnd = openers.reduce(
			(cursor, opener) => endOfGroup(schemaText, endOfTrivia(schemaText, cursor), opener, marker, markers),
			nameEnd
		);
		if (isOwnBlockName(schemaText.slice(nameStart, nameEnd), marker)) {
			ownBlocks.push([index, blockEnd]);
		}

		hasBlock = true;
		index = endOfTrivia(schemaText, blockEnd);
	}

	return ownBlocks.map((span) => withoutMarkers(schemaText, span, markers, marker?.length ?? 0)).join('\n\n');
}
