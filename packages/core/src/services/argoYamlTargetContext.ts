import {
  extractNavigationValue,
  getIndent,
  isReusableTemplateKind
} from "./argoYamlSyntax";
import {
  findContainingDagTasksSection,
  findReferenceBlockLine,
  getContainingArgoResource,
  getContainingTemplateName,
  isDirectTemplateDefinition,
  isInReusableTemplateMetadata
} from "./argoYamlDocumentContext";
import type {
  ArgoResourceContext,
  DocumentPosition,
  ReusableTemplateRefKey,
  TextDocumentReader
} from "./argoYamlDocumentContext";
import { findDagDependencyTaskAtPosition } from "./dagDependencySyntax";
import { getNavigationValueAtPosition } from "./argoYamlCursorSyntax";

export interface DagTaskContext {
  readonly resourceName: string;
  readonly templateName: string;
  readonly taskName: string;
}

export interface LocalTemplateContext {
  readonly resource: ArgoResourceContext;
  readonly templateName: string;
}

export interface TemplateRefContext {
  readonly workflowTemplateName: string;
  readonly templateName: string;
  readonly clusterScope?: true;
}

export interface WorkflowTemplateContext {
  readonly workflowTemplateName: string;
  readonly clusterScope?: true;
}

interface ReusableTemplateCallContext {
  readonly workflowTemplateName: string | undefined;
  readonly templateName: string | undefined;
  readonly clusterScope?: true;
}

export function getDagTaskDefinitionContext(
  document: TextDocumentReader,
  position: DocumentPosition
): DagTaskContext | undefined {
  const currentLine = document.getLine(position.line);
  if (!/^\s*-\s+name:\s*(.+)$/.test(currentLine)) {
    return undefined;
  }

  const tasksLine = findContainingDagTasksSection(document, position);
  if (tasksLine === -1 ||
      getIndent(currentLine) !== getIndent(document.getLine(tasksLine)) + 2) {
    return undefined;
  }

  const taskName = getNavigationValueAtPosition(document, position);
  const templateName = getContainingTemplateName(document, position);
  const resourceName = getContainingArgoResource(document, position)?.name;
  if (!taskName || !templateName || !resourceName) {
    return undefined;
  }

  return { resourceName, templateName, taskName };
}

export function getDagDependencyReferenceContext(
  document: TextDocumentReader,
  position: DocumentPosition
): DagTaskContext | undefined {
  const currentLine = document.getLine(position.line);
  if (!isDagDependencyReferenceLine(document, position, currentLine)) {
    return undefined;
  }

  const taskName = findDagDependencyTaskAtPosition(currentLine, position.character);
  if (!taskName || findContainingDagTasksSection(document, position) === -1) {
    return undefined;
  }

  const templateName = getContainingTemplateName(document, position);
  const resourceName = getContainingArgoResource(document, position)?.name;
  if (!templateName || !resourceName) {
    return undefined;
  }

  return { resourceName, templateName, taskName };
}

export function getTemplateRefContext(
  document: TextDocumentReader,
  position: DocumentPosition
): TemplateRefContext | undefined {
  if (!document.getLine(position.line).includes("template:")) {
    return undefined;
  }

  const ref = getReusableTemplateCallContext(document, position, "templateRef");
  if (!ref?.workflowTemplateName || !ref.templateName) {
    return undefined;
  }

  return {
    workflowTemplateName: ref.workflowTemplateName,
    templateName: ref.templateName,
    ...(ref.clusterScope ? { clusterScope: true } : {})
  };
}

export function getWorkflowTemplateRefName(
  document: TextDocumentReader,
  position: DocumentPosition
): WorkflowTemplateContext | undefined {
  const currentLine = document.getLine(position.line);
  if (!currentLine.includes("name:") || currentLine.includes("template:")) {
    return undefined;
  }

  const ref = getReusableTemplateCallContext(document, position, "templateRef") ??
    getReusableTemplateCallContext(document, position, "workflowTemplateRef");
  const workflowTemplateName = getNavigationValueAtPosition(document, position);
  if (!ref?.workflowTemplateName || ref.workflowTemplateName !== workflowTemplateName) {
    return undefined;
  }

  return {
    workflowTemplateName,
    ...(ref.clusterScope ? { clusterScope: true } : {})
  };
}

export function getTemplateDefinitionContext(
  document: TextDocumentReader,
  position: DocumentPosition
): LocalTemplateContext | undefined {
  const currentLine = document.getLine(position.line);
  if (!/^\s*-\s+name:\s*(.+)$/.test(currentLine) ||
      !isDirectTemplateDefinition(document, position.line)) {
    return undefined;
  }

  const templateName = getNavigationValueAtPosition(document, position);
  const resource = getContainingArgoResource(document, position);
  if (!templateName || !resource) {
    return undefined;
  }

  return { resource, templateName };
}

export function getWorkflowTemplateDefinitionName(
  document: TextDocumentReader,
  position: DocumentPosition
): WorkflowTemplateContext | undefined {
  const currentLine = document.getLine(position.line);
  if (!currentLine.includes("name:") || !isInReusableTemplateMetadata(document, position)) {
    return undefined;
  }

  const resource = getContainingArgoResource(document, position);
  if (!resource || !isReusableTemplateKind(resource.kind)) {
    return undefined;
  }

  return {
    workflowTemplateName: resource.name,
    ...(resource.kind === "ClusterWorkflowTemplate" ? { clusterScope: true } : {})
  };
}

export function getLocalTemplateCallContext(
  document: TextDocumentReader,
  position: DocumentPosition
): LocalTemplateContext | undefined {
  if (!isLocalTemplateCallLine(document, position)) {
    return undefined;
  }

  const templateName = getNavigationValueAtPosition(document, position);
  const resource = getContainingArgoResource(document, position);
  if (!templateName || !resource) {
    return undefined;
  }

  return { resource, templateName };
}

function isDagDependencyReferenceLine(
  document: TextDocumentReader,
  position: DocumentPosition,
  line: string
): boolean {
  if (/^\s*depends:\s*/.test(line) || /^\s*dependencies:\s*/.test(line)) {
    return true;
  }

  if (!/^\s*-\s*[A-Za-z0-9_-]+/.test(line)) {
    return false;
  }

  const listIndent = getIndent(line);
  for (let lineIndex = position.line - 1; lineIndex >= 0; lineIndex--) {
    const candidateLine = document.getLine(lineIndex);
    if (candidateLine.trim().length === 0 || getIndent(candidateLine) >= listIndent) {
      continue;
    }

    return /^\s*dependencies:\s*(?:#.*)?$/.test(candidateLine);
  }

  return false;
}

function getReusableTemplateCallContext(
  document: TextDocumentReader,
  position: DocumentPosition,
  key: ReusableTemplateRefKey
): ReusableTemplateCallContext | undefined {
  const blockLine = findReferenceBlockLine(document, position, key);
  if (blockLine === undefined) {
    return undefined;
  }

  const blockIndent = getIndent(document.getLine(blockLine));
  let workflowTemplateName: string | undefined;
  let templateName: string | undefined;
  let clusterScope = false;

  for (let lineIndex = blockLine + 1; lineIndex < document.lineCount; lineIndex++) {
    const line = document.getLine(lineIndex);
    if (line.trim().length === 0 || /^\s*#/.test(line)) {
      continue;
    }
    if (getIndent(line) <= blockIndent) {
      break;
    }
    if (/^\s*name:\s*/.test(line) && !workflowTemplateName) {
      workflowTemplateName = extractNavigationValue(line);
    } else if (/^\s*template:\s*/.test(line)) {
      templateName = extractNavigationValue(line);
    } else if (/^\s*clusterScope:\s*true\s*(?:#.*)?$/.test(line)) {
      clusterScope = true;
    }
  }

  return {
    workflowTemplateName,
    templateName,
    ...(clusterScope ? { clusterScope: true } : {})
  };
}

function isLocalTemplateCallLine(document: TextDocumentReader, position: DocumentPosition): boolean {
  const line = document.getLine(position.line);
  if (/^\s*(entrypoint|onExit):\s*/.test(line)) {
    return true;
  }

  return /^\s*template:\s*/.test(line) &&
    findReferenceBlockLine(document, position, "templateRef") === undefined;
}
