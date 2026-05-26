import { WorkflowTemplateLocation } from "../types";
import {
  extractKeyValue,
  getIndent,
  NavigationKey,
  ReusableTemplateKind
} from "./argoYamlSyntax";
import {
  findArgoResourceByName,
  findResourceEnd,
  findReusableTemplateDefinitionLines,
  findScopedDagTasksSection,
  findTemplateInTemplatesSection,
  findTemplatesSection
} from "./argoYamlStructure";
import {
  findDagDependencyRanges,
  findMultilineDependenciesEnd,
  isMultilineDependenciesLine
} from "./dagDependencySyntax";

interface ValueLocation {
  readonly value: string;
  readonly line: number;
  readonly character: number;
  readonly endCharacter: number;
}

interface ReusableTemplateReference {
  readonly name: ValueLocation | undefined;
  readonly template: ValueLocation | undefined;
  readonly clusterScope: boolean;
}

export function findReusableTemplateDefinitions(
  content: string,
  filePath: string,
  templateName: string,
  clusterScope: boolean
): WorkflowTemplateLocation[] {
  const lines = content.split("\n");

  return findReusableTemplateDefinitionLines(lines, templateName, clusterScope).map((line) => ({
    file: filePath,
    line,
    ...getNameValueRange(lines[line], templateName),
  }));
}

export function findTemplateDefinitionInResource(
  content: string,
  filePath: string,
  resourceName: string,
  templateName: string,
  resourceKind?: ReusableTemplateKind
): WorkflowTemplateLocation[] {
  const lines = content.split("\n");
  const resourceStart = findArgoResourceByName(lines, resourceName, resourceKind);
  if (resourceStart === -1) {
    return [];
  }

  const resourceEnd = findResourceEnd(lines, resourceStart);
  const templatesSection = findTemplatesSection(lines, resourceStart, resourceEnd);
  if (templatesSection === -1) {
    return [];
  }

  const line = findTemplateInTemplatesSection(lines, templatesSection, resourceEnd, templateName);
  if (line === -1) {
    return [];
  }

  return [{
    file: filePath,
    line,
    ...getNameValueRange(lines[line], templateName),
  }];
}

export function findReusableTemplateReferences(
  content: string,
  filePath: string,
  workflowTemplateName: string,
  templateName: string,
  clusterScope: boolean
): WorkflowTemplateLocation[] {
  const lines = content.split("\n");
  const locations: WorkflowTemplateLocation[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    if (!lines[lineIndex].includes("templateRef:")) {
      continue;
    }

    const ref = parseReusableTemplateReference(lines, lineIndex);
    if (ref.name?.value === workflowTemplateName &&
        ref.template?.value === templateName &&
        ref.clusterScope === clusterScope) {
      locations.push({ file: filePath, ...ref.template });
    }
  }

  return locations;
}

export function findReusableTemplateResourceReferences(
  content: string,
  filePath: string,
  workflowTemplateName: string,
  clusterScope: boolean
): WorkflowTemplateLocation[] {
  const lines = content.split("\n");
  const locations: WorkflowTemplateLocation[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    if (!lines[lineIndex].includes("templateRef:") &&
        !lines[lineIndex].includes("workflowTemplateRef:")) {
      continue;
    }

    const ref = parseReusableTemplateReference(lines, lineIndex);
    if (ref.name?.value === workflowTemplateName && ref.clusterScope === clusterScope) {
      locations.push({ file: filePath, ...ref.name });
    }
  }

  return locations;
}

export function findLocalTemplateReferences(
  content: string,
  filePath: string,
  resourceName: string,
  templateName: string,
  resourceKind?: ReusableTemplateKind
): WorkflowTemplateLocation[] {
  const lines = content.split("\n");
  const resourceStart = findArgoResourceByName(lines, resourceName, resourceKind);
  if (resourceStart === -1) {
    return [];
  }

  const resourceEnd = findResourceEnd(lines, resourceStart);
  const locations: WorkflowTemplateLocation[] = [];

  for (let lineIndex = resourceStart; lineIndex < resourceEnd; lineIndex++) {
    const key = getLocalTemplateCallKey(lines, lineIndex);
    if (!key || extractKeyValue(lines[lineIndex], key) !== templateName) {
      continue;
    }

    locations.push({
      file: filePath,
      line: lineIndex,
      ...getKeyValueRange(lines[lineIndex], key, templateName),
    });
  }

  return locations;
}

export function findDagTaskDefinition(
  content: string,
  filePath: string,
  resourceName: string,
  templateName: string,
  taskName: string
): WorkflowTemplateLocation[] {
  const lines = content.split("\n");
  const dagTasksSection = findScopedDagTasksSection(lines, resourceName, templateName);
  if (!dagTasksSection) {
    return [];
  }

  const locations: WorkflowTemplateLocation[] = [];
  for (let lineIndex = dagTasksSection.tasksStart + 1;
    lineIndex < dagTasksSection.tasksEnd;
    lineIndex++) {
    const line = lines[lineIndex];
    if (getIndent(line) === dagTasksSection.taskIndent &&
        /^\s*-\s+name:\s*/.test(line) &&
        extractKeyValue(line, "name") === taskName) {
      locations.push({
        file: filePath,
        line: lineIndex,
        ...getNameValueRange(line, taskName),
      });
    }
  }

  return locations;
}

export function findDagTaskReferences(
  content: string,
  filePath: string,
  resourceName: string,
  templateName: string,
  taskName: string
): WorkflowTemplateLocation[] {
  const lines = content.split("\n");
  const dagTasksSection = findScopedDagTasksSection(lines, resourceName, templateName);
  if (!dagTasksSection) {
    return [];
  }

  const locations: WorkflowTemplateLocation[] = [];
  for (let lineIndex = dagTasksSection.tasksStart + 1;
    lineIndex < dagTasksSection.tasksEnd;
    lineIndex++) {
    for (const range of findDagDependencyRanges(lines, lineIndex, dagTasksSection.tasksEnd, taskName)) {
      locations.push({
        file: filePath,
        line: range.line,
        character: range.character,
        endCharacter: range.endCharacter,
      });
    }

    if (isMultilineDependenciesLine(lines[lineIndex])) {
      lineIndex = findMultilineDependenciesEnd(lines, lineIndex, dagTasksSection.tasksEnd);
    }
  }

  return locations;
}

function parseReusableTemplateReference(lines: string[], startIndex: number): ReusableTemplateReference {
  let name: ValueLocation | undefined;
  let template: ValueLocation | undefined;
  let clusterScope = false;
  const blockIndent = getIndent(lines[startIndex]);

  for (let lineIndex = startIndex + 1; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    if (line.trim() === "" || /^\s*#/.test(line)) {
      continue;
    }
    if (getIndent(line) <= blockIndent) {
      break;
    }

    const nameValue = extractKeyValue(line, "name");
    if (nameValue && !name) {
      name = { value: nameValue, line: lineIndex, ...getKeyValueRange(line, "name", nameValue) };
    }

    const templateValue = extractKeyValue(line, "template");
    if (templateValue) {
      template = { value: templateValue, line: lineIndex, ...getKeyValueRange(line, "template", templateValue) };
    }

    if (/^\s*clusterScope:\s*true\s*(?:#.*)?$/.test(line)) {
      clusterScope = true;
    }
  }

  return { name, template, clusterScope };
}

function getNameValueRange(line: string, expectedValue: string): { character: number; endCharacter: number } {
  return getKeyValueRange(line, "name", expectedValue);
}

function getKeyValueRange(
  line: string,
  key: NavigationKey,
  expectedValue: string
): { character: number; endCharacter: number } {
  const match = line.match(new RegExp(`${key}:\\s*['"]?([^'"#\\s]+)['"]?\\s*(?:#.*)?$`));
  if (!match || match.index === undefined || match[1] !== expectedValue) {
    return { character: 0, endCharacter: line.length };
  }

  const characterInMatch = match[0].indexOf(expectedValue, match[0].indexOf(":") + 1);
  if (characterInMatch === -1) {
    return { character: 0, endCharacter: line.length };
  }

  const character = match.index + characterInMatch;
  return { character, endCharacter: character + expectedValue.length };
}

function getLocalTemplateCallKey(
  lines: string[],
  lineIndex: number
): "template" | "entrypoint" | "onExit" | undefined {
  const line = lines[lineIndex];
  if (/^\s*entrypoint:\s*/.test(line)) {
    return "entrypoint";
  }
  if (/^\s*onExit:\s*/.test(line)) {
    return "onExit";
  }
  if (/^\s*template:\s*/.test(line) && !isTemplateRefValueLine(lines, lineIndex)) {
    return "template";
  }

  return undefined;
}

function isTemplateRefValueLine(lines: string[], lineIndex: number): boolean {
  const lineIndent = getIndent(lines[lineIndex]);
  const startIndex = Math.max(0, lineIndex - 10);

  for (let candidateLine = lineIndex - 1; candidateLine >= startIndex; candidateLine--) {
    const line = lines[candidateLine];
    const indent = getIndent(line);
    if (indent < lineIndent && line.includes("templateRef:")) {
      return true;
    }
    if (indent < lineIndent && /^\s*-?\s*name:\s*/.test(line)) {
      return false;
    }
  }

  return false;
}
