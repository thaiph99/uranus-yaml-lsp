import { extractNavigationValue } from "./argoYamlSyntax";
import type { DocumentPosition } from "./argoYamlDocumentContext";

// `name:` also covers `generateName:`.
const navigationKeyPattern = /(?:name|template|entrypoint|onExit):/;

export function isNavigationCandidateLine(line: string): boolean {
  return navigationKeyPattern.test(line) ||
    line.includes("depends:") ||
    line.includes("dependencies:") ||
    /^\s*-\s*[A-Za-z0-9_-]+/.test(line);
}

export function getNavigationValueAtPosition(
  lines: string[],
  position: DocumentPosition
): string | undefined {
  const line = lines[position.line];
  return getWordAtPosition(line, position.character) ??
    (navigationKeyPattern.test(line) ? extractNavigationValue(line) : undefined);
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
