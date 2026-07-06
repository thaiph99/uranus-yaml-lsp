import {
  ArgoResourceKind,
  extractNavigationValue,
  getArgoResourceKind,
  getIndent,
  isArgoResourceLine
} from "./argoYamlSyntax";
import { findSequenceItemIndent } from "./argoYamlStructure";

export interface DocumentPosition {
  readonly line: number;
  readonly character: number;
}

export interface ArgoResourceContext {
  readonly kind: ArgoResourceKind;
  readonly name: string;
}

export type ReusableTemplateRefKey = "templateRef" | "workflowTemplateRef";

export function findContainingDagTasksSection(lines: string[], position: DocumentPosition): number {
  const positionLine = lines[position.line];
  const positionIndent = getIndent(positionLine);

  for (let lineIndex = position.line; lineIndex >= 0; lineIndex--) {
    const line = lines[lineIndex];
    if (!/^\s*tasks:\s*(?:#.*)?$/.test(line)) {
      continue;
    }

    const tasksIndent = getIndent(line);
    if (position.line !== lineIndex &&
        (positionIndent < tasksIndent ||
          (positionIndent === tasksIndent && !positionLine.trim().startsWith("- ")))) {
      continue;
    }

    if (!hasSectionBoundaryBetween(lines, lineIndex, position.line, tasksIndent, true) &&
        isDagTasksSection(lines, lineIndex)) {
      return lineIndex;
    }
  }

  return -1;
}

export function getContainingTemplateName(
  lines: string[],
  position: DocumentPosition
): string | undefined {
  for (let lineIndex = position.line; lineIndex >= 0; lineIndex--) {
    const line = lines[lineIndex];
    if (lineIndex < position.line && isArgoResourceLine(line)) {
      return undefined;
    }

    if (/^\s*-\s+name:\s*(.+)$/.test(line) &&
        isDirectTemplateDefinition(lines, lineIndex)) {
      return extractNavigationValue(line);
    }
  }

  return undefined;
}

export function findReferenceBlockLine(
  lines: string[],
  position: DocumentPosition,
  key: ReusableTemplateRefKey
): number | undefined {
  const startLine = Math.max(0, position.line - 15);
  const valueIndent = getIndent(lines[position.line]);
  const blockPattern = new RegExp(`^\\s*${key}:\\s*(?:#.*)?$`);

  for (let lineIndex = position.line; lineIndex >= startLine; lineIndex--) {
    const line = lines[lineIndex];
    const blockIndent = getIndent(line);
    if (blockPattern.test(line) &&
        blockIndent < valueIndent &&
        !hasSectionBoundaryBetween(lines, lineIndex, position.line, blockIndent)) {
      return lineIndex;
    }
  }

  return undefined;
}

export function getContainingArgoResource(
  lines: string[],
  position: DocumentPosition
): ArgoResourceContext | undefined {
  for (let lineIndex = position.line; lineIndex >= 0; lineIndex--) {
    const kind = getArgoResourceKind(lines[lineIndex]);
    if (!kind) {
      continue;
    }

    const endLine = Math.min(lines.length, lineIndex + 20);
    for (let metadataLineIndex = lineIndex + 1; metadataLineIndex < endLine; metadataLineIndex++) {
      const metadataLine = lines[metadataLineIndex];
      if (metadataLine.includes("name:") || metadataLine.includes("generateName:")) {
        const name = extractNavigationValue(metadataLine);
        return name ? { kind, name } : undefined;
      }
    }
  }

  return undefined;
}

export function isDirectTemplateDefinition(lines: string[], lineIndex: number): boolean {
  const templatesLineIndex = findContainingTemplatesSection(lines, lineIndex);
  if (templatesLineIndex === -1) {
    return false;
  }

  return getIndent(lines[lineIndex]) === findSequenceItemIndent(lines, templatesLineIndex, lineIndex + 1);
}

export function isInReusableTemplateMetadata(
  lines: string[],
  position: DocumentPosition
): boolean {
  let foundReusableTemplate = false;
  let foundMetadata = false;
  const startLine = Math.max(0, position.line - 20);

  for (let lineIndex = position.line; lineIndex >= startLine; lineIndex--) {
    const line = lines[lineIndex];
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
  lines: string[],
  startLine: number,
  endLine: number,
  sectionIndent: number,
  itemsAtSectionIndentBelong = false
): boolean {
  for (let lineIndex = startLine + 1; lineIndex < endLine; lineIndex++) {
    const trimmed = lines[lineIndex].trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }

    const indent = getIndent(lines[lineIndex]);
    if (indent < sectionIndent ||
        (indent === sectionIndent && !(itemsAtSectionIndentBelong && trimmed.startsWith("- ")))) {
      return true;
    }
  }

  return false;
}

function isDagTasksSection(lines: string[], tasksLineIndex: number): boolean {
  const tasksIndent = getIndent(lines[tasksLineIndex]);

  for (let lineIndex = tasksLineIndex - 1; lineIndex >= 0; lineIndex--) {
    const line = lines[lineIndex];
    if (line.trim() === "" || getIndent(line) >= tasksIndent) {
      continue;
    }

    return /^\s*dag:\s*(?:#.*)?$/.test(line);
  }

  return false;
}

function findContainingTemplatesSection(lines: string[], lineIndex: number): number {
  for (let candidateLine = lineIndex; candidateLine >= 0; candidateLine--) {
    const line = lines[candidateLine];
    if (line.includes("templates:")) {
      return candidateLine;
    }
    if (line.includes("kind:") || line.includes("apiVersion:")) {
      return -1;
    }
  }

  return -1;
}
