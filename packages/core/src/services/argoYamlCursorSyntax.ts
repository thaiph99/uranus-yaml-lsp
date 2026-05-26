import { extractNavigationValue } from "./argoYamlSyntax";
import type { DocumentPosition, TextDocumentReader } from "./argoYamlDocumentContext";

export function isNavigationCandidateLine(line: string): boolean {
  return (
    line.includes("name:") ||
    line.includes("template:") ||
    line.includes("entrypoint:") ||
    line.includes("onExit:") ||
    line.includes("depends:") ||
    line.includes("dependencies:") ||
    /^\s*-\s*[A-Za-z0-9_-]+/.test(line)
  );
}

export function getNavigationValueAtPosition(
  document: TextDocumentReader,
  position: DocumentPosition
): string | undefined {
  const line = document.getLine(position.line);
  return getWordAtPosition(line, position.character) ??
    (hasNavigationValue(line) ? extractNavigationValue(line) : undefined);
}

function hasNavigationValue(line: string): boolean {
  return (
    line.includes("name:") ||
    line.includes("template:") ||
    line.includes("entrypoint:") ||
    line.includes("onExit:") ||
    line.includes("generateName:")
  );
}

function getWordAtPosition(line: string, character: number): string | undefined {
  const start = findWordStart(line, character);
  const end = findWordEnd(line, character);
  if (start === end) {
    return undefined;
  }

  const word = line.substring(start, end);
  return word.length > 0 && /[\w-]/.test(word) ? word : undefined;
}

function findWordStart(line: string, character: number): number {
  const startCharacter = Math.min(character, line.length - 1);
  for (let index = startCharacter; index >= 0; index--) {
    if (!/[\w-]/.test(line[index])) {
      return index + 1;
    }
  }

  return 0;
}

function findWordEnd(line: string, character: number): number {
  for (let index = Math.max(0, character); index < line.length; index++) {
    if (!/[\w-]/.test(line[index])) {
      return index;
    }
  }

  return line.length;
}
