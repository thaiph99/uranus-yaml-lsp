import { TemplateRefContext } from "../types";

export interface DocumentPosition {
  readonly line: number;
  readonly character: number;
}

export interface TextDocumentReader {
  readonly lineCount: number;
  getLine(line: number): string;
}

export type ArgoYamlNavigationTarget =
  | {
      readonly kind: "templateReferences";
      readonly workflowTemplateName: string;
      readonly templateName: string;
      readonly clusterScope?: true;
    }
  | {
      readonly kind: "workflowTemplateReferences";
      readonly workflowTemplateName: string;
      readonly clusterScope?: true;
    }
  | {
      readonly kind: "templateDefinition";
      readonly workflowTemplateName: string;
      readonly templateName: string;
      readonly clusterScope?: true;
    }
  | {
      readonly kind: "localTemplateDefinition";
      readonly resourceName: string;
      readonly templateName: string;
    }
  | {
      readonly kind: "localTemplateReferences";
      readonly resourceName: string;
      readonly templateName: string;
    }
  | {
      readonly kind: "dagTaskDefinition";
      readonly resourceName: string;
      readonly templateName: string;
      readonly taskName: string;
    }
  | {
      readonly kind: "dagTaskReferences";
      readonly resourceName: string;
      readonly templateName: string;
      readonly taskName: string;
    }
  | {
      readonly kind: "workflowTemplateDefinition";
      readonly workflowTemplateName: string;
      readonly clusterScope?: true;
    };

export interface TemplateReferenceContext {
  readonly workflowTemplateName: string;
  readonly templateName: string;
}

type ArgoResourceKind = "Workflow" | "CronWorkflow" | "WorkflowTemplate" | "ClusterWorkflowTemplate";

interface ArgoResourceContext {
  readonly kind: ArgoResourceKind;
  readonly name: string;
}

interface LocalTemplateContext {
  readonly resource: ArgoResourceContext;
  readonly templateName: string;
}

type ReusableTemplateRefKey = "templateRef" | "workflowTemplateRef";

interface ReusableTemplateCallContext {
  readonly workflowTemplateName: string | undefined;
  readonly templateName: string | undefined;
  readonly clusterScope?: true;
}

export class ArgoYamlNavigationService {
  public getNavigationTarget(
    document: TextDocumentReader,
    position: DocumentPosition
  ): ArgoYamlNavigationTarget | undefined {
    const line = document.getLine(position.line);
    if (!this.isNameReference(line)) {
      return undefined;
    }

    const dagDependencyReference = this.getDagDependencyReferenceContext(document, position);
    if (dagDependencyReference) {
      return {
        kind: "dagTaskDefinition",
        resourceName: dagDependencyReference.resourceName,
        templateName: dagDependencyReference.templateName,
        taskName: dagDependencyReference.taskName
      };
    }

    const dagTaskDefinition = this.getDagTaskDefinitionContext(document, position);
    if (dagTaskDefinition) {
      return {
        kind: "dagTaskReferences",
        resourceName: dagTaskDefinition.resourceName,
        templateName: dagTaskDefinition.templateName,
        taskName: dagTaskDefinition.taskName
      };
    }

    const templateDefinition = this.getTemplateDefinitionContext(document, position);
    if (templateDefinition) {
      if (this.isReusableTemplateKind(templateDefinition.resource.kind)) {
        return {
          kind: "templateReferences",
          workflowTemplateName: templateDefinition.resource.name,
          templateName: templateDefinition.templateName,
          ...(templateDefinition.resource.kind === "ClusterWorkflowTemplate" ? { clusterScope: true } : {})
        };
      }

      return {
        kind: "localTemplateReferences",
        resourceName: templateDefinition.resource.name,
        templateName: templateDefinition.templateName
      };
    }

    const workflowTemplateDefinition = this.getWorkflowTemplateDefinitionName(document, position);
    if (workflowTemplateDefinition) {
      return {
        kind: "workflowTemplateReferences",
        workflowTemplateName: workflowTemplateDefinition.workflowTemplateName,
        ...(workflowTemplateDefinition.clusterScope ? { clusterScope: true } : {})
      };
    }

    const templateRefContext = this.getTemplateRefContext(document, position);
    if (templateRefContext) {
      return {
        kind: "templateDefinition",
        workflowTemplateName: templateRefContext.workflowTemplateName,
        templateName: templateRefContext.templateName,
        ...(templateRefContext.clusterScope ? { clusterScope: true } : {})
      };
    }

    const workflowTemplateRef = this.getWorkflowTemplateRefName(document, position);
    if (workflowTemplateRef) {
      return {
        kind: "workflowTemplateDefinition",
        workflowTemplateName: workflowTemplateRef.workflowTemplateName,
        ...(workflowTemplateRef.clusterScope ? { clusterScope: true } : {})
      };
    }

    const localTemplateCall = this.getLocalTemplateCallContext(document, position);
    if (localTemplateCall) {
      return {
        kind: "localTemplateDefinition",
        resourceName: localTemplateCall.resource.name,
        templateName: localTemplateCall.templateName
      };
    }

    return undefined;
  }

  public getTemplateReferenceContext(
    document: TextDocumentReader,
    position: DocumentPosition
  ): TemplateReferenceContext | undefined {
    const templateName = this.getNameAtPosition(document, position);
    if (!templateName) {
      return undefined;
    }

    const resourceName = this.getContainingArgoResource(document, position)?.name;
    if (!resourceName) {
      return undefined;
    }

    return { workflowTemplateName: resourceName, templateName };
  }

  public getWorkflowTemplateNameAtPosition(
    document: TextDocumentReader,
    position: DocumentPosition
  ): string | undefined {
    return this.getNameAtPosition(document, position);
  }

  private isNameReference(line: string): boolean {
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

  private getDagTaskDefinitionContext(
    document: TextDocumentReader,
    position: DocumentPosition
  ): { resourceName: string; templateName: string; taskName: string } | undefined {
    const currentLine = document.getLine(position.line);
    if (!/^\s*-\s+name:\s*(.+)$/.test(currentLine)) {
      return undefined;
    }

    const dagTasksLineIndex = this.findContainingDagTasksSection(document, position);
    if (dagTasksLineIndex === -1) {
      return undefined;
    }

    if (this.getIndent(currentLine) !== this.getIndent(document.getLine(dagTasksLineIndex)) + 2) {
      return undefined;
    }

    const taskName = this.getNameAtPosition(document, position);
    const templateName = this.getContainingTemplateName(document, position);
    const resourceName = this.getContainingArgoResource(document, position)?.name;
    if (!taskName || !templateName || !resourceName) {
      return undefined;
    }

    return { resourceName, templateName, taskName };
  }

  private getDagDependencyReferenceContext(
    document: TextDocumentReader,
    position: DocumentPosition
  ): { resourceName: string; templateName: string; taskName: string } | undefined {
    const currentLine = document.getLine(position.line);
    if (!this.isDagDependencyReferenceLine(document, position, currentLine)) {
      return undefined;
    }

    const taskName = currentLine.includes("depends:")
      ? this.extractDependsTokenAtPosition(currentLine, position.character)
      : this.extractDependencyTokenAtPosition(currentLine, position.character);
    if (!taskName) {
      return undefined;
    }

    const dagTasksLineIndex = this.findContainingDagTasksSection(document, position);
    if (dagTasksLineIndex === -1) {
      return undefined;
    }

    const templateName = this.getContainingTemplateName(document, position);
    const resourceName = this.getContainingArgoResource(document, position)?.name;
    if (!templateName || !resourceName) {
      return undefined;
    }

    return { resourceName, templateName, taskName };
  }

  private isDagDependencyReferenceLine(
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

    const listIndent = this.getIndent(line);
    for (let lineIndex = position.line - 1; lineIndex >= 0; lineIndex--) {
      const candidateLine = document.getLine(lineIndex);
      if (candidateLine.trim().length === 0) {
        continue;
      }

      const candidateIndent = this.getIndent(candidateLine);
      if (candidateIndent >= listIndent) {
        continue;
      }

      return /^\s*dependencies:\s*(?:#.*)?$/.test(candidateLine);
    }

    return false;
  }

  private findContainingDagTasksSection(
    document: TextDocumentReader,
    position: DocumentPosition
  ): number {
    const positionIndent = this.getIndent(document.getLine(position.line));

    for (let lineIndex = position.line; lineIndex >= 0; lineIndex--) {
      const line = document.getLine(lineIndex);
      if (!/^\s*tasks:\s*(?:#.*)?$/.test(line)) {
        continue;
      }

      const tasksIndent = this.getIndent(line);
      if (position.line !== lineIndex && positionIndent <= tasksIndent) {
        continue;
      }

      if (this.hasSectionBoundaryBetween(document, lineIndex, position.line, tasksIndent)) {
        continue;
      }

      if (this.isDagTasksSection(document, lineIndex)) {
        return lineIndex;
      }
    }

    return -1;
  }

  private hasSectionBoundaryBetween(
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

      if (this.getIndent(line) <= sectionIndent) {
        return true;
      }
    }

    return false;
  }

  private isDagTasksSection(document: TextDocumentReader, tasksLineIndex: number): boolean {
    const tasksIndent = this.getIndent(document.getLine(tasksLineIndex));

    for (let lineIndex = tasksLineIndex - 1; lineIndex >= 0; lineIndex--) {
      const line = document.getLine(lineIndex);
      if (line.trim().length === 0) {
        continue;
      }

      const indent = this.getIndent(line);
      if (indent >= tasksIndent) {
        continue;
      }

      return /^\s*dag:\s*(?:#.*)?$/.test(line);
    }

    return false;
  }

  private getContainingTemplateName(
    document: TextDocumentReader,
    position: DocumentPosition
  ): string | undefined {
    for (let lineIndex = position.line; lineIndex >= 0; lineIndex--) {
      const line = document.getLine(lineIndex);
      if (lineIndex < position.line && this.isArgoResourceKindLine(line)) {
        return undefined;
      }
      if (!/^\s*-\s+name:\s*(.+)$/.test(line)) {
        continue;
      }

      if (this.isDirectTemplateDefinition(document, { line: lineIndex, character: line.indexOf("name:") + 6 })) {
        return this.extractNameValue(line);
      }
    }

    return undefined;
  }

  private extractDependencyTokenAtPosition(line: string, character: number): string | undefined {
    const tokenRanges = this.getTokenRanges(line, /[A-Za-z0-9_-]+/g);
    const filteredRanges = line.includes("dependencies:")
      ? tokenRanges.filter((range) => range.value !== "dependencies")
      : tokenRanges;

    return this.findTokenAtPosition(filteredRanges, character);
  }

  private extractDependsTokenAtPosition(line: string, character: number): string | undefined {
    const tokenRanges = this.getTokenRanges(line, /[A-Za-z0-9_-]+(?:\.[A-Za-z]+)?/g)
      .filter((range) => range.value !== "depends")
      .map((range) => {
        const taskName = range.value.match(/^([A-Za-z0-9_-]+)/)?.[1];
        return {
          start: range.start,
          end: range.start + (taskName?.length ?? range.value.length),
          value: taskName ?? range.value
        };
      });

    return this.findTokenAtPosition(tokenRanges, character);
  }

  private getTokenRanges(
    line: string,
    pattern: RegExp
  ): Array<{ start: number; end: number; value: string }> {
    const ranges: Array<{ start: number; end: number; value: string }> = [];
    for (const match of line.matchAll(pattern)) {
      if (match.index === undefined) {
        continue;
      }

      ranges.push({ start: match.index, end: match.index + match[0].length, value: match[0] });
    }

    return ranges;
  }

  private findTokenAtPosition(
    tokenRanges: Array<{ start: number; end: number; value: string }>,
    character: number
  ): string | undefined {
    return tokenRanges.find((range) => character >= range.start && character < range.end)?.value;
  }

  private getTemplateRefContext(
    document: TextDocumentReader,
    position: DocumentPosition
  ): TemplateRefContext | undefined {
    const currentLine = document.getLine(position.line);
    if (!currentLine.includes("template:")) {
      return undefined;
    }

    const ref = this.getReusableTemplateCallContext(document, position, "templateRef");
    if (!ref?.workflowTemplateName || !ref.templateName) {
      return undefined;
    }

    return {
      workflowTemplateName: ref.workflowTemplateName,
      templateName: ref.templateName,
      ...(ref.clusterScope ? { clusterScope: true } : {})
    };
  }

  private getReusableTemplateCallContext(
    document: TextDocumentReader,
    position: DocumentPosition,
    key: ReusableTemplateRefKey
  ): ReusableTemplateCallContext | undefined {
    const blockLine = this.findReferenceBlockLine(document, position, key);
    if (blockLine === undefined) {
      return undefined;
    }

    const blockIndent = this.getIndent(document.getLine(blockLine));
    let workflowTemplateName: string | undefined;
    let templateName: string | undefined;
    let clusterScope = false;

    for (let lineIndex = blockLine + 1; lineIndex < document.lineCount; lineIndex++) {
      const line = document.getLine(lineIndex);
      if (line.trim().length === 0 || /^\s*#/.test(line)) {
        continue;
      }
      if (this.getIndent(line) <= blockIndent) {
        break;
      }
      if (/^\s*name:\s*/.test(line) && !workflowTemplateName) {
        workflowTemplateName = this.extractNameValue(line);
      } else if (/^\s*template:\s*/.test(line)) {
        templateName = this.extractNameValue(line);
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

  private getNameAtPosition(
    document: TextDocumentReader,
    position: DocumentPosition
  ): string | undefined {
    const line = document.getLine(position.line);
    const wordAtPosition = this.getWordAtPosition(line, position.character);
    if (wordAtPosition) {
      return wordAtPosition;
    }

    if (this.hasNavigationValue(line)) {
      return this.extractNameValue(line);
    }

    return undefined;
  }

  private getWordAtPosition(line: string, character: number): string | undefined {
    const wordStart = this.findWordStart(line, character);
    const wordEnd = this.findWordEnd(line, character);

    if (wordStart === wordEnd) {
      return undefined;
    }

    const word = line.substring(wordStart, wordEnd);
    return word.length > 0 && /[\w-]/.test(word) ? word : undefined;
  }

  private findWordStart(line: string, character: number): number {
    const startCharacter = Math.min(character, line.length - 1);
    for (let index = startCharacter; index >= 0; index--) {
      if (!/[\w-]/.test(line[index])) {
        return index + 1;
      }
    }
    return 0;
  }

  private findWordEnd(line: string, character: number): number {
    for (let index = Math.max(0, character); index < line.length; index++) {
      if (!/[\w-]/.test(line[index])) {
        return index;
      }
    }
    return line.length;
  }

  private getWorkflowTemplateRefName(
    document: TextDocumentReader,
    position: DocumentPosition
  ): { workflowTemplateName: string; clusterScope?: true } | undefined {
    const currentLine = document.getLine(position.line);
    if (!currentLine.includes("name:") || currentLine.includes("template:")) {
      return undefined;
    }

    const ref = this.getReusableTemplateCallContext(document, position, "templateRef") ??
      this.getReusableTemplateCallContext(document, position, "workflowTemplateRef");
    const workflowTemplateName = this.getNameAtPosition(document, position);
    if (!ref?.workflowTemplateName || ref.workflowTemplateName !== workflowTemplateName) {
      return undefined;
    }

    return {
      workflowTemplateName,
      ...(ref.clusterScope ? { clusterScope: true } : {})
    };
  }

  private findReferenceBlockLine(
    document: TextDocumentReader,
    position: DocumentPosition,
    key: ReusableTemplateRefKey
  ): number | undefined {
    const startLine = Math.max(0, position.line - 15);
    const valueIndent = this.getIndent(document.getLine(position.line));
    const blockPattern = new RegExp(`^\\s*${key}:\\s*(?:#.*)?$`);

    for (let lineIndex = position.line; lineIndex >= startLine; lineIndex--) {
      const line = document.getLine(lineIndex);
      const blockIndent = this.getIndent(line);
      if (blockPattern.test(line) &&
          blockIndent < valueIndent &&
          !this.hasSectionBoundaryBetween(document, lineIndex, position.line, blockIndent)) {
        return lineIndex;
      }
    }

    return undefined;
  }

  private getTemplateDefinitionContext(
    document: TextDocumentReader,
    position: DocumentPosition
  ): LocalTemplateContext | undefined {
    const currentLine = document.getLine(position.line);
    if (!currentLine.includes("name:") || !/^\s*-\s+name:\s*(.+)$/.test(currentLine)) {
      return undefined;
    }

    if (!this.isDirectTemplateDefinition(document, position)) {
      return undefined;
    }

    const templateName = this.getNameAtPosition(document, position);
    const resource = this.getContainingArgoResource(document, position);

    if (!templateName || !resource) {
      return undefined;
    }

    return { resource, templateName };
  }

  private isDirectTemplateDefinition(
    document: TextDocumentReader,
    position: DocumentPosition
  ): boolean {
    const templatesLineIndex = this.findContainingTemplatesSection(document, position);
    if (templatesLineIndex === -1) {
      return false;
    }

    return this.getIndent(document.getLine(position.line)) === this.getIndent(document.getLine(templatesLineIndex)) + 2;
  }

  private findContainingTemplatesSection(
    document: TextDocumentReader,
    position: DocumentPosition
  ): number {
    for (let lineIndex = position.line; lineIndex >= 0; lineIndex--) {
      const line = document.getLine(lineIndex);
      if (line.includes("templates:")) {
        return lineIndex;
      }
      if (line.includes("kind:") || line.includes("apiVersion:")) {
        return -1;
      }
    }

    return -1;
  }

  private getContainingArgoResource(
    document: TextDocumentReader,
    position: DocumentPosition
  ): ArgoResourceContext | undefined {
    for (let lineIndex = position.line; lineIndex >= 0; lineIndex--) {
      const line = document.getLine(lineIndex);
      const kind = this.getArgoResourceKind(line);
      if (!kind) {
        continue;
      }

      const endLine = Math.min(document.lineCount, lineIndex + 20);
      for (let metadataLineIndex = lineIndex + 1; metadataLineIndex < endLine; metadataLineIndex++) {
        const metadataLine = document.getLine(metadataLineIndex);
        if (metadataLine.includes("name:") || metadataLine.includes("generateName:")) {
          const name = this.extractNameValue(metadataLine);
          return name ? { kind, name } : undefined;
        }
      }
    }

    return undefined;
  }

  private isReusableTemplateKind(kind: ArgoResourceKind): boolean {
    return kind === "WorkflowTemplate" || kind === "ClusterWorkflowTemplate";
  }

  private getWorkflowTemplateDefinitionName(
    document: TextDocumentReader,
    position: DocumentPosition
  ): { workflowTemplateName: string; clusterScope?: true } | undefined {
    const currentLine = document.getLine(position.line);
    if (!currentLine.includes("name:") || !this.isInWorkflowTemplateMetadata(document, position)) {
      return undefined;
    }

    const resource = this.getContainingArgoResource(document, position);
    if (!resource || !this.isReusableTemplateKind(resource.kind)) {
      return undefined;
    }

    return {
      workflowTemplateName: resource.name,
      ...(resource.kind === "ClusterWorkflowTemplate" ? { clusterScope: true } : {})
    };
  }

  private isInWorkflowTemplateMetadata(
    document: TextDocumentReader,
    position: DocumentPosition
  ): boolean {
    let foundWorkflowTemplate = false;
    let foundMetadata = false;
    const startLine = Math.max(0, position.line - 20);

    for (let lineIndex = position.line; lineIndex >= startLine; lineIndex--) {
      const line = document.getLine(lineIndex);
      if (line.includes("metadata:")) {
        foundMetadata = true;
      }
      if (line.includes("kind: WorkflowTemplate") || line.includes("kind: ClusterWorkflowTemplate")) {
        foundWorkflowTemplate = true;
        break;
      }
      if (line.includes("spec:") || line.includes("status:")) {
        return false;
      }
    }

    return foundWorkflowTemplate && foundMetadata;
  }

  private extractNameValue(line: string): string | undefined {
    const nameMatch = line.match(/(?:name|generateName|template|entrypoint|onExit):\s*['"]?([^'"#\s]+)['"]?\s*(?:#.*)?$/);
    return nameMatch?.[1];
  }

  private getLocalTemplateCallContext(
    document: TextDocumentReader,
    position: DocumentPosition
  ): LocalTemplateContext | undefined {
    const currentLine = document.getLine(position.line);
    if (!this.isLocalTemplateCallLine(document, position, currentLine)) {
      return undefined;
    }

    const templateName = this.getNameAtPosition(document, position);
    const resource = this.getContainingArgoResource(document, position);
    if (!templateName || !resource) {
      return undefined;
    }

    return { resource, templateName };
  }

  private isLocalTemplateCallLine(
    document: TextDocumentReader,
    position: DocumentPosition,
    line: string
  ): boolean {
    if (/^\s*(entrypoint|onExit):\s*/.test(line)) {
      return true;
    }

    if (!/^\s*template:\s*/.test(line)) {
      return false;
    }

    return this.findReferenceBlockLine(document, position, "templateRef") === undefined;
  }

  private hasNavigationValue(line: string): boolean {
    return (
      line.includes("name:") ||
      line.includes("template:") ||
      line.includes("entrypoint:") ||
      line.includes("onExit:") ||
      line.includes("generateName:")
    );
  }

  private isArgoResourceKindLine(line: string): boolean {
    return this.getArgoResourceKind(line) !== undefined;
  }

  private getArgoResourceKind(line: string): ArgoResourceKind | undefined {
    return line.match(/kind:\s*(Workflow|CronWorkflow|WorkflowTemplate|ClusterWorkflowTemplate)\s*(?:#.*)?$/)?.[1] as ArgoResourceKind | undefined;
  }

  private getIndent(line: string): number {
    return line.match(/^\s*/)?.[0].length ?? 0;
  }
}
