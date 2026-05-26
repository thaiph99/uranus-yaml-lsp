import { TemplateRefContext } from "../types";
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

export type { DocumentPosition, TextDocumentReader } from "./argoYamlDocumentContext";

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

interface LocalTemplateContext {
  readonly resource: ArgoResourceContext;
  readonly templateName: string;
}

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
      if (isReusableTemplateKind(templateDefinition.resource.kind)) {
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

    const resourceName = getContainingArgoResource(document, position)?.name;
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

    const dagTasksLineIndex = findContainingDagTasksSection(document, position);
    if (dagTasksLineIndex === -1) {
      return undefined;
    }

    if (getIndent(currentLine) !== getIndent(document.getLine(dagTasksLineIndex)) + 2) {
      return undefined;
    }

    const taskName = this.getNameAtPosition(document, position);
    const templateName = getContainingTemplateName(document, position);
    const resourceName = getContainingArgoResource(document, position)?.name;
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

    const taskName = findDagDependencyTaskAtPosition(currentLine, position.character);
    if (!taskName) {
      return undefined;
    }

    const dagTasksLineIndex = findContainingDagTasksSection(document, position);
    if (dagTasksLineIndex === -1) {
      return undefined;
    }

    const templateName = getContainingTemplateName(document, position);
    const resourceName = getContainingArgoResource(document, position)?.name;
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

    const listIndent = getIndent(line);
    for (let lineIndex = position.line - 1; lineIndex >= 0; lineIndex--) {
      const candidateLine = document.getLine(lineIndex);
      if (candidateLine.trim().length === 0) {
        continue;
      }

      const candidateIndent = getIndent(candidateLine);
      if (candidateIndent >= listIndent) {
        continue;
      }

      return /^\s*dependencies:\s*(?:#.*)?$/.test(candidateLine);
    }

    return false;
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
      return extractNavigationValue(line);
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

  private getTemplateDefinitionContext(
    document: TextDocumentReader,
    position: DocumentPosition
  ): LocalTemplateContext | undefined {
    const currentLine = document.getLine(position.line);
    if (!currentLine.includes("name:") || !/^\s*-\s+name:\s*(.+)$/.test(currentLine)) {
      return undefined;
    }

    if (!isDirectTemplateDefinition(document, position.line)) {
      return undefined;
    }

    const templateName = this.getNameAtPosition(document, position);
    const resource = getContainingArgoResource(document, position);

    if (!templateName || !resource) {
      return undefined;
    }

    return { resource, templateName };
  }

  private getWorkflowTemplateDefinitionName(
    document: TextDocumentReader,
    position: DocumentPosition
  ): { workflowTemplateName: string; clusterScope?: true } | undefined {
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

  private getLocalTemplateCallContext(
    document: TextDocumentReader,
    position: DocumentPosition
  ): LocalTemplateContext | undefined {
    const currentLine = document.getLine(position.line);
    if (!this.isLocalTemplateCallLine(document, position, currentLine)) {
      return undefined;
    }

    const templateName = this.getNameAtPosition(document, position);
    const resource = getContainingArgoResource(document, position);
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

    return findReferenceBlockLine(document, position, "templateRef") === undefined;
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

}
