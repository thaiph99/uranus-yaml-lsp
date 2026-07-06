import {
  extractKeyValue,
  getArgoResourceKind,
  getIndent,
  getReusableTemplateKind,
  isArgoResourceLine,
  ReusableTemplateKind
} from "./argoYamlSyntax";

export interface DagTasksSection {
  readonly tasksStart: number;
  readonly tasksEnd: number;
  readonly taskIndent: number;
}

export function findReusableTemplateDefinitionLines(
  lines: string[],
  resourceName: string,
  clusterScope: boolean
): number[] {
  const resourceKind = getReusableTemplateKind(clusterScope);
  const definitionLines: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (getArgoResourceKind(lines[i]) !== resourceKind) {
      continue;
    }

    const nameLine = findResourceNameLine(lines, i, resourceName);
    if (nameLine !== -1) {
      definitionLines.push(nameLine);
    }
  }

  return definitionLines;
}

export function findArgoResourceByName(
  lines: string[],
  resourceName: string,
  resourceKind?: ReusableTemplateKind
): number {
  for (let i = 0; i < lines.length; i++) {
    if (resourceKind
      ? getArgoResourceKind(lines[i]) !== resourceKind
      : !isArgoResourceLine(lines[i])) {
      continue;
    }

    for (let j = i; j < Math.min(lines.length, i + 20); j++) {
      if (isMetadataNameLine(lines, j) && hasResourceName(lines[j], resourceName)) {
        return i;
      }
    }
  }

  return -1;
}

export function findResourceEnd(lines: string[], startIndex: number): number {
  for (let i = startIndex + 1; i < lines.length; i++) {
    // Only top-level lines end a resource; indented `kind:` / `apiVersion:`
    // lines belong to embedded manifests (e.g. `manifest: |` block scalars).
    const line = lines[i];
    if (getIndent(line) !== 0) {
      continue;
    }
    if (line.startsWith("kind:") || (line.startsWith("apiVersion:") && lines[i - 1]?.trim() === "---")) {
      return i;
    }
  }

  return lines.length;
}

export function findTemplatesSection(lines: string[], startIndex: number, endIndex: number): number {
  for (let i = startIndex; i < endIndex; i++) {
    if (lines[i].trim().startsWith("templates:")) {
      return i;
    }
  }

  return -1;
}

export function findTemplateInTemplatesSection(
  lines: string[],
  templatesStart: number,
  templatesEnd: number,
  templateName: string
): number {
  const templateDefinitionIndent = findSequenceItemIndent(lines, templatesStart, templatesEnd);
  if (templateDefinitionIndent === -1) {
    return -1;
  }

  for (let i = templatesStart + 1; i < templatesEnd; i++) {
    const line = lines[i];
    if (
      getIndent(line) === templateDefinitionIndent &&
      /^\s*-\s+name:\s*['"]?([^'"#\s]+)['"]?\s*(?:#.*)?$/.test(line) &&
      extractKeyValue(line, "name") === templateName
    ) {
      return i;
    }
  }

  return -1;
}

export function findScopedDagTasksSection(
  lines: string[],
  resourceName: string,
  templateName: string
): DagTasksSection | undefined {
  const resourceStart = findArgoResourceByName(lines, resourceName);
  if (resourceStart === -1) {
    return undefined;
  }

  const resourceEnd = findResourceEnd(lines, resourceStart);
  const templatesSection = findTemplatesSection(lines, resourceStart, resourceEnd);
  if (templatesSection === -1) {
    return undefined;
  }

  const templateStart = findTemplateInTemplatesSection(lines, templatesSection, resourceEnd, templateName);
  if (templateStart === -1) {
    return undefined;
  }

  const templateEnd = findTemplateBlockEnd(lines, templateStart, resourceEnd);
  const dagStart = findChildKeyLine(lines, templateStart, templateEnd, "dag");
  if (dagStart === -1) {
    return undefined;
  }

  const tasksStart = findChildKeyLine(lines, dagStart, templateEnd, "tasks");
  if (tasksStart === -1) {
    return undefined;
  }

  const tasksEnd = findIndentedBlockEnd(lines, tasksStart, templateEnd);
  const taskIndent = findSequenceItemIndent(lines, tasksStart, tasksEnd);
  if (taskIndent === -1) {
    return undefined;
  }

  return { tasksStart, tasksEnd, taskIndent };
}

// YAML sequence items may sit at their parent key's indent or deeper, so the
// item indent must be read from the first item instead of assumed to be +2.
export function findSequenceItemIndent(lines: string[], keyLineIndex: number, endIndex: number): number {
  const keyIndent = getIndent(lines[keyLineIndex]);

  for (let i = keyLineIndex + 1; i < endIndex; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }

    const indent = getIndent(lines[i]);
    return indent >= keyIndent && trimmed.startsWith("- ") ? indent : -1;
  }

  return -1;
}

function findResourceNameLine(lines: string[], startIndex: number, resourceName: string): number {
  const resourceEnd = findResourceEnd(lines, startIndex);

  for (let i = startIndex; i < resourceEnd; i++) {
    if (isMetadataNameLine(lines, i) && extractKeyValue(lines[i], "name") === resourceName) {
      return i;
    }
  }

  return -1;
}

function isMetadataNameLine(lines: string[], lineIndex: number): boolean {
  return lineIndex > 0 && lines[lineIndex - 1].includes("metadata:");
}

function hasResourceName(line: string, resourceName: string): boolean {
  return extractKeyValue(line, "name") === resourceName ||
    extractKeyValue(line, "generateName") === resourceName;
}

function findTemplateBlockEnd(lines: string[], templateStart: number, resourceEnd: number): number {
  const templateIndent = getIndent(lines[templateStart]);

  for (let i = templateStart + 1; i < resourceEnd; i++) {
    const line = lines[i];
    if (line.trim() === "") {
      continue;
    }

    if (getIndent(line) === templateIndent && /^\s*-\s+name:\s*/.test(line)) {
      return i;
    }
  }

  return resourceEnd;
}

function findChildKeyLine(
  lines: string[],
  parentStart: number,
  parentEnd: number,
  key: "dag" | "tasks"
): number {
  const parentIndent = getIndent(lines[parentStart]);

  for (let i = parentStart + 1; i < parentEnd; i++) {
    const line = lines[i];
    if (line.trim() === "") {
      continue;
    }

    const indent = getIndent(line);
    if (indent <= parentIndent) {
      return -1;
    }

    if (new RegExp(`^\\s*${key}:\\s*(?:#.*)?$`).test(line)) {
      return i;
    }
  }

  return -1;
}

function findIndentedBlockEnd(lines: string[], blockStart: number, maxEnd: number): number {
  const blockIndent = getIndent(lines[blockStart]);

  for (let i = blockStart + 1; i < maxEnd; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === "") {
      continue;
    }

    const indent = getIndent(lines[i]);
    // Sequence items at the block key's own indent still belong to the block.
    if (indent < blockIndent || (indent === blockIndent && !trimmed.startsWith("- "))) {
      return i;
    }
  }

  return maxEnd;
}
