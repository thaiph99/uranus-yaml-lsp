import { getIndent } from "./argoYamlSyntax";

export interface DagDependencyRange {
  readonly line: number;
  readonly character: number;
  readonly endCharacter: number;
}

interface TokenRange {
  readonly start: number;
  readonly end: number;
  readonly value: string;
}

export function findDagDependencyTaskAtPosition(line: string, character: number): string | undefined {
  if (/^\s*depends:\s*/.test(line)) {
    const tokens = getTokenRanges(line, /[A-Za-z0-9_-]+(?:\.[A-Za-z]+)?/g)
      .filter((range) => range.value !== "depends")
      .map((range) => {
        const taskName = range.value.match(/^([A-Za-z0-9_-]+)/)?.[1] ?? range.value;
        return { start: range.start, end: range.start + taskName.length, value: taskName };
      });
    return findTokenAtPosition(tokens, character);
  }

  const tokens = getTokenRanges(line, /[A-Za-z0-9_-]+/g)
    .filter((range) => range.value !== "dependencies");
  return findTokenAtPosition(tokens, character);
}

export function findDagDependencyRanges(
  lines: string[],
  lineIndex: number,
  tasksEnd: number,
  taskName: string
): DagDependencyRange[] {
  const line = lines[lineIndex];

  if (/^\s*dependencies:\s*\[/.test(line)) {
    return findInlineDependencyRanges(line, lineIndex, taskName);
  }

  if (isMultilineDependenciesLine(line)) {
    return findMultilineDependencyRanges(lines, lineIndex, tasksEnd, taskName);
  }

  if (/^\s*depends:\s*/.test(line)) {
    return findDependsExpressionRanges(line, lineIndex, taskName);
  }

  return [];
}

export function isMultilineDependenciesLine(line: string): boolean {
  return /^\s*dependencies:\s*$/.test(line);
}

export function findMultilineDependenciesEnd(
  lines: string[],
  dependenciesLine: number,
  tasksEnd: number
): number {
  const dependenciesIndent = getIndent(lines[dependenciesLine]);

  for (let index = dependenciesLine + 1; index < tasksEnd; index++) {
    const line = lines[index];
    if (line.trim() === "") {
      continue;
    }

    if (getIndent(line) <= dependenciesIndent) {
      return index - 1;
    }
  }

  return tasksEnd - 1;
}

function findInlineDependencyRanges(
  line: string,
  lineIndex: number,
  taskName: string
): DagDependencyRange[] {
  const ranges: DagDependencyRange[] = [];
  const listStart = line.indexOf("[");
  const listEnd = line.indexOf("]", listStart + 1);
  if (listStart === -1 || listEnd === -1) {
    return ranges;
  }

  const listContent = line.slice(listStart + 1, listEnd);
  const dependencyPattern = /['"]?([A-Za-z0-9_-]+)['"]?/g;
  let match: RegExpExecArray | null;

  while ((match = dependencyPattern.exec(listContent)) !== null) {
    if (match[1] !== taskName || match.index === undefined) {
      continue;
    }

    const character = listStart + 1 + match.index + match[0].indexOf(taskName);
    ranges.push({ line: lineIndex, character, endCharacter: character + taskName.length });
  }

  return ranges;
}

function findMultilineDependencyRanges(
  lines: string[],
  dependenciesLine: number,
  tasksEnd: number,
  taskName: string
): DagDependencyRange[] {
  const ranges: DagDependencyRange[] = [];
  const dependenciesIndent = getIndent(lines[dependenciesLine]);

  for (let index = dependenciesLine + 1; index < tasksEnd; index++) {
    const line = lines[index];
    if (line.trim() === "") {
      continue;
    }

    if (getIndent(line) <= dependenciesIndent) {
      break;
    }

    const itemMatch = line.match(/^\s*-\s*['"]?([^'"#\s\]]+)['"]?\s*(?:#.*)?$/);
    if (!itemMatch || itemMatch[1] !== taskName) {
      continue;
    }

    const character = line.indexOf(taskName);
    ranges.push({ line: index, character, endCharacter: character + taskName.length });
  }

  return ranges;
}

function findDependsExpressionRanges(
  line: string,
  lineIndex: number,
  taskName: string
): DagDependencyRange[] {
  const ranges: DagDependencyRange[] = [];
  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) {
    return ranges;
  }

  const valueStart = colonIndex + 1;
  const value = line.slice(valueStart);
  let tokenStart = -1;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  const pushToken = (tokenEnd: number): void => {
    if (tokenStart === -1) {
      return;
    }

    const token = value.slice(tokenStart, tokenEnd);
    if (token.split(".", 1)[0] === taskName) {
      const character = valueStart + tokenStart;
      ranges.push({ line: lineIndex, character, endCharacter: character + taskName.length });
    }

    tokenStart = -1;
  };

  for (let index = 0; index < value.length; index++) {
    const character = value[index];

    if (!inSingleQuote && !inDoubleQuote && character === "#") {
      pushToken(index);
      break;
    }

    if (character === "'" && !inDoubleQuote) {
      pushToken(index);
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (character === '"' && !inSingleQuote) {
      pushToken(index);
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (/[A-Za-z0-9_\.-]/.test(character)) {
      if (tokenStart === -1) {
        tokenStart = index;
      }
      continue;
    }

    pushToken(index);
  }

  pushToken(value.length);
  return ranges;
}

function getTokenRanges(line: string, pattern: RegExp): TokenRange[] {
  const ranges: TokenRange[] = [];
  for (const match of line.matchAll(pattern)) {
    if (match.index !== undefined) {
      ranges.push({ start: match.index, end: match.index + match[0].length, value: match[0] });
    }
  }
  return ranges;
}

function findTokenAtPosition(ranges: TokenRange[], character: number): string | undefined {
  return ranges.find((range) => character >= range.start && character < range.end)?.value;
}
