import {
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
  ReusableTemplateRefKey
} from "./argoYamlDocumentContext";
import { findSequenceItemIndent } from "./argoYamlStructure";
import { parseReusableTemplateReference } from "./argoYamlLocationSearch";
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

export function getDagTaskDefinitionContext(
  lines: string[],
  position: DocumentPosition
): DagTaskContext | undefined {
  const currentLine = lines[position.line];
  if (!/^\s*-\s+name:\s*(.+)$/.test(currentLine)) {
    return undefined;
  }

  const tasksLine = findContainingDagTasksSection(lines, position);
  if (tasksLine === -1 ||
      getIndent(currentLine) !== findSequenceItemIndent(lines, tasksLine, position.line + 1)) {
    return undefined;
  }

  const taskName = getNavigationValueAtPosition(lines, position);
  const templateName = getContainingTemplateName(lines, position);
  const resourceName = getContainingArgoResource(lines, position)?.name;
  if (!taskName || !templateName || !resourceName) {
    return undefined;
  }

  return { resourceName, templateName, taskName };
}

export function getDagDependencyReferenceContext(
  lines: string[],
  position: DocumentPosition
): DagTaskContext | undefined {
  const currentLine = lines[position.line];
  if (!isDagDependencyReferenceLine(lines, position, currentLine)) {
    return undefined;
  }

  const taskName = findDagDependencyTaskAtPosition(currentLine, position.character);
  if (!taskName || findContainingDagTasksSection(lines, position) === -1) {
    return undefined;
  }

  const templateName = getContainingTemplateName(lines, position);
  const resourceName = getContainingArgoResource(lines, position)?.name;
  if (!templateName || !resourceName) {
    return undefined;
  }

  return { resourceName, templateName, taskName };
}

export function getTemplateRefContext(
  lines: string[],
  position: DocumentPosition
): TemplateRefContext | undefined {
  if (!lines[position.line].includes("template:")) {
    return undefined;
  }

  const ref = getReusableTemplateCall(lines, position, "templateRef");
  if (!ref?.name?.value || !ref.template?.value) {
    return undefined;
  }

  return {
    workflowTemplateName: ref.name.value,
    templateName: ref.template.value,
    ...(ref.clusterScope ? { clusterScope: true } : {})
  };
}

export function getWorkflowTemplateRefName(
  lines: string[],
  position: DocumentPosition
): WorkflowTemplateContext | undefined {
  const currentLine = lines[position.line];
  if (!currentLine.includes("name:") || currentLine.includes("template:")) {
    return undefined;
  }

  const ref = getReusableTemplateCall(lines, position, "templateRef") ??
    getReusableTemplateCall(lines, position, "workflowTemplateRef");
  const workflowTemplateName = getNavigationValueAtPosition(lines, position);
  if (!ref?.name?.value || ref.name.value !== workflowTemplateName) {
    return undefined;
  }

  return {
    workflowTemplateName,
    ...(ref.clusterScope ? { clusterScope: true } : {})
  };
}

export function getTemplateDefinitionContext(
  lines: string[],
  position: DocumentPosition
): LocalTemplateContext | undefined {
  const currentLine = lines[position.line];
  if (!/^\s*-\s+name:\s*(.+)$/.test(currentLine) ||
      !isDirectTemplateDefinition(lines, position.line)) {
    return undefined;
  }

  const templateName = getNavigationValueAtPosition(lines, position);
  const resource = getContainingArgoResource(lines, position);
  if (!templateName || !resource) {
    return undefined;
  }

  return { resource, templateName };
}

export function getWorkflowTemplateDefinitionName(
  lines: string[],
  position: DocumentPosition
): WorkflowTemplateContext | undefined {
  const currentLine = lines[position.line];
  if (!currentLine.includes("name:") || !isInReusableTemplateMetadata(lines, position)) {
    return undefined;
  }

  const resource = getContainingArgoResource(lines, position);
  if (!resource || !isReusableTemplateKind(resource.kind)) {
    return undefined;
  }

  return {
    workflowTemplateName: resource.name,
    ...(resource.kind === "ClusterWorkflowTemplate" ? { clusterScope: true } : {})
  };
}

export function getLocalTemplateCallContext(
  lines: string[],
  position: DocumentPosition
): LocalTemplateContext | undefined {
  if (!isLocalTemplateCallLine(lines, position)) {
    return undefined;
  }

  const templateName = getNavigationValueAtPosition(lines, position);
  const resource = getContainingArgoResource(lines, position);
  if (!templateName || !resource) {
    return undefined;
  }

  return { resource, templateName };
}

function isDagDependencyReferenceLine(
  lines: string[],
  position: DocumentPosition,
  line: string
): boolean {
  if (/^\s*(depends|dependencies):\s*/.test(line)) {
    return true;
  }

  if (!/^\s*-\s*[A-Za-z0-9_-]+/.test(line)) {
    return false;
  }

  const listIndent = getIndent(line);
  for (let lineIndex = position.line - 1; lineIndex >= 0; lineIndex--) {
    const candidateLine = lines[lineIndex];
    if (candidateLine.trim() === "" || getIndent(candidateLine) >= listIndent) {
      continue;
    }

    return /^\s*dependencies:\s*(?:#.*)?$/.test(candidateLine);
  }

  return false;
}

function getReusableTemplateCall(
  lines: string[],
  position: DocumentPosition,
  key: ReusableTemplateRefKey
) {
  const blockLine = findReferenceBlockLine(lines, position, key);
  return blockLine === undefined ? undefined : parseReusableTemplateReference(lines, blockLine);
}

function isLocalTemplateCallLine(lines: string[], position: DocumentPosition): boolean {
  const line = lines[position.line];
  if (/^\s*(entrypoint|onExit):\s*/.test(line)) {
    return true;
  }

  return /^\s*template:\s*/.test(line) &&
    findReferenceBlockLine(lines, position, "templateRef") === undefined;
}
