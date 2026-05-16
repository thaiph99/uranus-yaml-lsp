import { TemplateRefContext } from "../types";

export interface DocumentPosition {
  readonly line: number;
  readonly character: number;
}

export interface TextDocumentReader {
  readonly lineCount: number;
  getLine(line: number): string;
  getTextInRange(startLine: number, endLine: number): string;
}

export type ArgoYamlNavigationTarget =
  | {
      readonly kind: "templateReferences";
      readonly workflowTemplateName: string;
      readonly templateName: string;
    }
  | {
      readonly kind: "workflowTemplateReferences";
      readonly workflowTemplateName: string;
    }
  | {
      readonly kind: "templateDefinition";
      readonly workflowTemplateName: string;
      readonly templateName: string;
    }
  | {
      readonly kind: "workflowTemplateDefinition";
      readonly workflowTemplateName: string;
    };

export interface TemplateReferenceContext {
  readonly workflowTemplateName: string;
  readonly templateName: string;
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

    const templateDefinition = this.getTemplateDefinitionContext(document, position);
    if (templateDefinition) {
      return {
        kind: "templateReferences",
        workflowTemplateName: templateDefinition.workflowTemplateName,
        templateName: templateDefinition.templateName
      };
    }

    const workflowTemplateDefinition = this.getWorkflowTemplateDefinitionName(document, position);
    if (workflowTemplateDefinition) {
      return {
        kind: "workflowTemplateReferences",
        workflowTemplateName: workflowTemplateDefinition
      };
    }

    const templateRefContext = this.getTemplateRefContext(document, position);
    if (templateRefContext) {
      return {
        kind: "templateDefinition",
        workflowTemplateName: templateRefContext.workflowTemplateName,
        templateName: templateRefContext.templateName
      };
    }

    const workflowTemplateRef = this.getWorkflowTemplateRefName(document, position);
    if (workflowTemplateRef) {
      return {
        kind: "workflowTemplateDefinition",
        workflowTemplateName: workflowTemplateRef
      };
    }

    const templateName = this.getNameAtPosition(document, position);
    if (!templateName || templateName.length < 2) {
      return undefined;
    }

    return {
      kind: "workflowTemplateDefinition",
      workflowTemplateName: templateName
    };
  }

  public getTemplateReferenceContext(
    document: TextDocumentReader,
    position: DocumentPosition
  ): TemplateReferenceContext | undefined {
    const templateName = this.getNameAtPosition(document, position);
    if (!templateName) {
      return undefined;
    }

    const workflowTemplateName = this.getContainingWorkflowTemplateName(document, position);
    if (!workflowTemplateName) {
      return undefined;
    }

    return { workflowTemplateName, templateName };
  }

  public getWorkflowTemplateNameAtPosition(
    document: TextDocumentReader,
    position: DocumentPosition
  ): string | undefined {
    return this.getNameAtPosition(document, position);
  }

  private isNameReference(line: string): boolean {
    return line.includes("name:") || line.includes("template:");
  }

  private getTemplateRefContext(
    document: TextDocumentReader,
    position: DocumentPosition
  ): TemplateRefContext | undefined {
    const currentLine = document.getLine(position.line);
    if (!currentLine.includes("template:")) {
      return undefined;
    }

    const templateName = this.getNameAtPosition(document, position);
    if (!templateName) {
      return undefined;
    }

    const workflowTemplateName = this.findWorkflowTemplateNameInTemplateRef(document, position);
    if (!workflowTemplateName) {
      return undefined;
    }

    return { workflowTemplateName, templateName };
  }

  private findWorkflowTemplateNameInTemplateRef(
    document: TextDocumentReader,
    position: DocumentPosition
  ): string | undefined {
    const startLine = Math.max(0, position.line - 15);
    const endLine = Math.min(document.lineCount - 1, position.line + 3);

    for (let lineIndex = position.line; lineIndex >= startLine; lineIndex--) {
      if (!document.getLine(lineIndex).includes("templateRef:")) {
        continue;
      }

      for (let candidateLine = lineIndex + 1; candidateLine <= endLine; candidateLine++) {
        const nameCandidate = document.getLine(candidateLine);
        if (nameCandidate.includes("name:") && !nameCandidate.includes("template:")) {
          return this.extractNameValue(nameCandidate);
        }
      }
    }

    return undefined;
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

    if (line.includes("name:") || line.includes("template:")) {
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
  ): string | undefined {
    const currentLine = document.getLine(position.line);
    if (!currentLine.includes("name:") || currentLine.includes("template:")) {
      return undefined;
    }

    if (!this.isInTemplateRefBlock(document, position)) {
      return undefined;
    }

    return this.getNameAtPosition(document, position);
  }

  private isInTemplateRefBlock(
    document: TextDocumentReader,
    position: DocumentPosition
  ): boolean {
    const startLine = Math.max(0, position.line - 5);

    for (let lineIndex = position.line; lineIndex >= startLine; lineIndex--) {
      const line = document.getLine(lineIndex);
      if (line.includes("templateRef:")) {
        return true;
      }
      if (line.includes("- name:") && lineIndex < position.line) {
        return false;
      }
    }

    return false;
  }

  private getTemplateDefinitionContext(
    document: TextDocumentReader,
    position: DocumentPosition
  ): TemplateReferenceContext | undefined {
    const currentLine = document.getLine(position.line);
    if (!currentLine.includes("name:") || !/^\s*-\s+name:\s*(.+)$/.test(currentLine)) {
      return undefined;
    }

    if (!this.isWithinTemplatesSection(document, position)) {
      return undefined;
    }

    const templateName = this.getNameAtPosition(document, position);
    const workflowTemplateName = this.getContainingWorkflowTemplateName(document, position);

    if (!templateName || !workflowTemplateName) {
      return undefined;
    }

    return { workflowTemplateName, templateName };
  }

  private isWithinTemplatesSection(
    document: TextDocumentReader,
    position: DocumentPosition
  ): boolean {
    const startLine = Math.max(0, position.line - 50);

    for (let lineIndex = position.line; lineIndex >= startLine; lineIndex--) {
      const line = document.getLine(lineIndex);
      if (line.includes("templates:")) {
        return true;
      }
      if (line.includes("kind:") || line.includes("apiVersion:")) {
        return false;
      }
    }

    return false;
  }

  private getContainingWorkflowTemplateName(
    document: TextDocumentReader,
    position: DocumentPosition
  ): string | undefined {
    for (let lineIndex = position.line; lineIndex >= 0; lineIndex--) {
      const line = document.getLine(lineIndex);
      if (!line.includes("kind: WorkflowTemplate")) {
        continue;
      }

      const endLine = Math.min(document.lineCount, lineIndex + 20);
      for (let metadataLineIndex = lineIndex + 1; metadataLineIndex < endLine; metadataLineIndex++) {
        const metadataLine = document.getLine(metadataLineIndex);
        if (metadataLine.includes("name:")) {
          return this.extractNameValue(metadataLine);
        }
      }
    }

    return undefined;
  }

  private getWorkflowTemplateDefinitionName(
    document: TextDocumentReader,
    position: DocumentPosition
  ): string | undefined {
    const currentLine = document.getLine(position.line);
    if (!currentLine.includes("name:") || !this.isInWorkflowTemplateMetadata(document, position)) {
      return undefined;
    }

    return this.extractNameValue(currentLine);
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
      if (line.includes("kind: WorkflowTemplate")) {
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
    const nameMatch = line.match(/(?:name|template):\s*['"]?([^'"#\s]+)['"]?\s*(?:#.*)?$/);
    return nameMatch?.[1];
  }
}
