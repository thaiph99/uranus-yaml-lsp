import {
  ArgoResourceKind,
  extractNavigationValue,
  getArgoResourceKind,
  getIndent,
  isArgoResourceLine
} from "./argoYamlSyntax";

export interface DocumentPosition {
  readonly line: number;
  readonly character: number;
}

export interface TextDocumentReader {
  readonly lineCount: number;
  getLine(line: number): string;
}

export interface ArgoResourceContext {
  readonly kind: ArgoResourceKind;
  readonly name: string;
}

export type ReusableTemplateRefKey = "templateRef" | "workflowTemplateRef";

export function findContainingDagTasksSection(
  document: TextDocumentReader,
  position: DocumentPosition
): number {
  const positionIndent = getIndent(document.getLine(position.line));

  for (let lineIndex = position.line; lineIndex >= 0; lineIndex--) {
    const line = document.getLine(lineIndex);
    if (!/^\s*tasks:\s*(?:#.*)?$/.test(line)) {
      continue;
    }

    const tasksIndent = getIndent(line);
    if (position.line !== lineIndex && positionIndent <= tasksIndent) {
      continue;
    }

    if (!hasSectionBoundaryBetween(document, lineIndex, position.line, tasksIndent) &&
        isDagTasksSection(document, lineIndex)) {
      return lineIndex;
    }
  }

  return -1;
}

export function getContainingTemplateName(
  document: TextDocumentReader,
  position: DocumentPosition
): string | undefined {
  for (let lineIndex = position.line; lineIndex >= 0; lineIndex--) {
    const line = document.getLine(lineIndex);
    if (lineIndex < position.line && isArgoResourceLine(line)) {
      return undefined;
    }

    if (/^\s*-\s+name:\s*(.+)$/.test(line) &&
        isDirectTemplateDefinition(document, lineIndex)) {
      return extractNavigationValue(line);
    }
  }

  return undefined;
}

export function findReferenceBlockLine(
  document: TextDocumentReader,
  position: DocumentPosition,
  key: ReusableTemplateRefKey
): number | undefined {
  const startLine = Math.max(0, position.line - 15);
  const valueIndent = getIndent(document.getLine(position.line));
  const blockPattern = new RegExp(`^\\s*${key}:\\s*(?:#.*)?$`);

  for (let lineIndex = position.line; lineIndex >= startLine; lineIndex--) {
    const line = document.getLine(lineIndex);
    const blockIndent = getIndent(line);
    if (blockPattern.test(line) &&
        blockIndent < valueIndent &&
        !hasSectionBoundaryBetween(document, lineIndex, position.line, blockIndent)) {
      return lineIndex;
    }
  }

  return undefined;
}

export function getContainingArgoResource(
  document: TextDocumentReader,
  position: DocumentPosition
): ArgoResourceContext | undefined {
  for (let lineIndex = position.line; lineIndex >= 0; lineIndex--) {
    const kind = getArgoResourceKind(document.getLine(lineIndex));
    if (!kind) {
      continue;
    }

    const endLine = Math.min(document.lineCount, lineIndex + 20);
    for (let metadataLineIndex = lineIndex + 1; metadataLineIndex < endLine; metadataLineIndex++) {
      const metadataLine = document.getLine(metadataLineIndex);
      if (metadataLine.includes("name:") || metadataLine.includes("generateName:")) {
        const name = extractNavigationValue(metadataLine);
        return name ? { kind, name } : undefined;
      }
    }
  }

  return undefined;
}

export function isDirectTemplateDefinition(document: TextDocumentReader, lineIndex: number): boolean {
  const templatesLineIndex = findContainingTemplatesSection(document, lineIndex);
  if (templatesLineIndex === -1) {
    return false;
  }

  return getIndent(document.getLine(lineIndex)) === getIndent(document.getLine(templatesLineIndex)) + 2;
}

export function isInReusableTemplateMetadata(
  document: TextDocumentReader,
  position: DocumentPosition
): boolean {
  let foundReusableTemplate = false;
  let foundMetadata = false;
  const startLine = Math.max(0, position.line - 20);

  for (let lineIndex = position.line; lineIndex >= startLine; lineIndex--) {
    const line = document.getLine(lineIndex);
    if (line.includes("metadata:")) {
      foundMetadata = true;
    }
    if (line.includes("kind: WorkflowTemplate") || line.includes("kind: ClusterWorkflowTemplate")) {
      foundReusableTemplate = true;
      break;
    }
    if (line.includes("spec:") || line.includes("status:")) {
      return false;
    }
  }

  return foundReusableTemplate && foundMetadata;
}

function hasSectionBoundaryBetween(
  document: TextDocumentReader,
  startLine: number,
  endLine: number,
  sectionIndent: number
): boolean {
  for (let lineIndex = startLine + 1; lineIndex < endLine; lineIndex++) {
    const line = document.getLine(lineIndex);
    if (line.trim().length === 0 || /^\s*#/.test(line)) {
      continue;
    }

    if (getIndent(line) <= sectionIndent) {
      return true;
    }
  }

  return false;
}

function isDagTasksSection(document: TextDocumentReader, tasksLineIndex: number): boolean {
  const tasksIndent = getIndent(document.getLine(tasksLineIndex));

  for (let lineIndex = tasksLineIndex - 1; lineIndex >= 0; lineIndex--) {
    const line = document.getLine(lineIndex);
    if (line.trim().length === 0) {
      continue;
    }

    if (getIndent(line) >= tasksIndent) {
      continue;
    }

    return /^\s*dag:\s*(?:#.*)?$/.test(line);
  }

  return false;
}

function findContainingTemplatesSection(document: TextDocumentReader, lineIndex: number): number {
  for (let candidateLine = lineIndex; candidateLine >= 0; candidateLine--) {
    const line = document.getLine(candidateLine);
    if (line.includes("templates:")) {
      return candidateLine;
    }
    if (line.includes("kind:") || line.includes("apiVersion:")) {
      return -1;
    }
  }

  return -1;
}
