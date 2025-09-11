import {
  DefinitionParams,
  Location,
  LocationLink,
  Position,
  TextDocuments
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  TemplateSearchService,
  TemplateRefContext
} from '@uranus-yaml/core';

export class DefinitionHandler {
  constructor(
    private templateSearchService: TemplateSearchService,
    private documents: TextDocuments<TextDocument>,
    private workspaceRoot: string
  ) {}

  async handleDefinition(params: DefinitionParams): Promise<Location | Location[] | LocationLink[] | null> {
    const document = this.documents.get(params.textDocument.uri);
    if (!document) {
      return null;
    }

    const position = params.position;
    const line = document.getText({
      start: { line: position.line, character: 0 },
      end: { line: position.line, character: Number.MAX_VALUE }
    });

    if (!this.isNameReference(line)) {
      return null;
    }

    // Check if we're clicking on a template definition (show references)
    const templateDefinitionContext = this.extractTemplateDefinitionContext(document, position);
    if (templateDefinitionContext) {
      return this.findTemplateReferences(templateDefinitionContext);
    }

    // Check if we're clicking on a WorkflowTemplate name definition (show references)
    const workflowTemplateDefinitionContext = this.extractWorkflowTemplateDefinitionContext(document, position);
    if (workflowTemplateDefinitionContext) {
      return this.findWorkflowTemplateReferences(workflowTemplateDefinitionContext);
    }

    // Check if we're in a templateRef context (go to definition)
    const templateRefContext = this.extractTemplateRefContext(document, position);
    if (templateRefContext) {
      return this.findTemplateInWorkflowTemplate(templateRefContext);
    }

    // Check if we're clicking on a WorkflowTemplate reference
    const workflowTemplateRef = this.extractWorkflowTemplateRef(document, position);
    if (workflowTemplateRef) {
      return this.findWorkflowTemplate(workflowTemplateRef);
    }

    // Fallback: general template search
    const templateName = this.extractTemplateName(document, position);
    if (!templateName || templateName.length < 2) {
      return null;
    }

    return this.findWorkflowTemplate(templateName);
  }

  private isNameReference(line: string): boolean {
    return line.includes("name:") || line.includes("template:");
  }

  private extractTemplateRefContext(
    document: TextDocument,
    position: Position
  ): TemplateRefContext | undefined {
    const currentLine = document.getText({
      start: { line: position.line, character: 0 },
      end: { line: position.line, character: Number.MAX_VALUE }
    });

    if (!currentLine.includes("template:")) {
      return undefined;
    }

    const templateName = this.extractTemplateName(document, position);
    if (!templateName) {
      return undefined;
    }

    const workflowTemplateName = this.findWorkflowTemplateNameInTemplateRef(document, position);
    if (!workflowTemplateName) {
      return undefined;
    }

    return {
      workflowTemplateName,
      templateName
    };
  }

  private findWorkflowTemplateNameInTemplateRef(
    document: TextDocument,
    position: Position
  ): string | undefined {
    const startLine = Math.max(0, position.line - 15);
    
    for (let i = position.line; i >= startLine; i--) {
      const line = document.getText({
        start: { line: i, character: 0 },
        end: { line: i, character: Number.MAX_VALUE }
      });

      if (line.includes("templateRef:")) {
        const endLine = Math.min(document.lineCount - 1, position.line + 3);
        for (let j = i + 1; j <= endLine; j++) {
          const nameCandidate = document.getText({
            start: { line: j, character: 0 },
            end: { line: j, character: Number.MAX_VALUE }
          });
          if (nameCandidate.includes("name:") && !nameCandidate.includes("template:")) {
            const nameMatch = nameCandidate.match(/name:\s*['"]?([^'"#\s]+)['"]?\s*(?:#.*)?$/);
            if (nameMatch) {
              return nameMatch[1];
            }
          }
        }
      }
    }
    return undefined;
  }

  private extractTemplateName(
    document: TextDocument,
    position: Position
  ): string | undefined {
    const line = document.getText({
      start: { line: position.line, character: 0 },
      end: { line: position.line, character: Number.MAX_VALUE }
    });

    // Try to get word at position
    const wordStart = this.findWordStart(line, position.character);
    const wordEnd = this.findWordEnd(line, position.character);
    
    if (wordStart !== -1 && wordEnd !== -1) {
      const word = line.substring(wordStart, wordEnd);
      if (word && /[\w-]/.test(word)) {
        return word;
      }
    }

    // Fallback: extract from line using regex
    if (line.includes("name:")) {
      const nameMatch = line.match(/name:\s*['"]?([^'"#\s]+)['"]?\s*(?:#.*)?$/);
      if (nameMatch) {
        return nameMatch[1];
      }
    }

    if (line.includes("template:")) {
      const templateMatch = line.match(/template:\s*['"]?([^'"#\s]+)['"]?\s*(?:#.*)?$/);
      if (templateMatch) {
        return templateMatch[1];
      }
    }

    return undefined;
  }

  private findWordStart(line: string, character: number): number {
    for (let i = character; i >= 0; i--) {
      if (!/[\w-]/.test(line[i])) {
        return i + 1;
      }
    }
    return 0;
  }

  private findWordEnd(line: string, character: number): number {
    for (let i = character; i < line.length; i++) {
      if (!/[\w-]/.test(line[i])) {
        return i;
      }
    }
    return line.length;
  }

  private extractTemplateDefinitionContext(
    document: TextDocument,
    position: Position
  ): { workflowTemplateName: string; templateName: string } | undefined {
    const currentLine = document.getText({
      start: { line: position.line, character: 0 },
      end: { line: position.line, character: Number.MAX_VALUE }
    });

    if (!currentLine.includes("name:")) {
      return undefined;
    }

    const templateNameMatch = currentLine.match(/^\s*-\s+name:\s*(.+)$/);
    if (!templateNameMatch) {
      return undefined;
    }

    if (!this.isWithinTemplatesSection(document, position)) {
      return undefined;
    }

    const templateName = this.extractTemplateName(document, position);
    if (!templateName) {
      return undefined;
    }

    const workflowTemplateName = this.findContainingWorkflowTemplate(document, position);
    if (!workflowTemplateName) {
      return undefined;
    }

    return {
      workflowTemplateName,
      templateName
    };
  }

  private isWithinTemplatesSection(
    document: TextDocument,
    position: Position
  ): boolean {
    const startLine = Math.max(0, position.line - 50);
    
    for (let i = position.line; i >= startLine; i--) {
      const line = document.getText({
        start: { line: i, character: 0 },
        end: { line: i, character: Number.MAX_VALUE }
      });
      if (line.includes("templates:")) {
        return true;
      }
      if (line.includes("kind:") || line.includes("apiVersion:")) {
        return false;
      }
    }
    return false;
  }

  private findContainingWorkflowTemplate(
    document: TextDocument,
    position: Position
  ): string | undefined {
    for (let i = position.line; i >= 0; i--) {
      const line = document.getText({
        start: { line: i, character: 0 },
        end: { line: i, character: Number.MAX_VALUE }
      });

      if (line.includes("kind: WorkflowTemplate")) {
        const endLine = Math.min(document.lineCount, i + 20);
        for (let j = i; j < endLine; j++) {
          const metadataLine = document.getText({
            start: { line: j, character: 0 },
            end: { line: j, character: Number.MAX_VALUE }
          });
          if (metadataLine.includes("name:") && j > i) {
            const nameMatch = metadataLine.match(/name:\s*['"]?([^'"#\s]+)['"]?\s*(?:#.*)?$/);
            if (nameMatch) {
              return nameMatch[1];
            }
          }
        }
      }
    }
    return undefined;
  }

  private extractWorkflowTemplateDefinitionContext(
    document: TextDocument,
    position: Position
  ): string | undefined {
    const currentLine = document.getText({
      start: { line: position.line, character: 0 },
      end: { line: position.line, character: Number.MAX_VALUE }
    });

    if (!currentLine.includes("name:")) {
      return undefined;
    }

    if (!this.isInWorkflowTemplateMetadata(document, position)) {
      return undefined;
    }

    const nameMatch = currentLine.match(/name:\s*['"]?([^'"#\s]+)['"]?\s*(?:#.*)?$/);
    if (nameMatch) {
      return nameMatch[1];
    }

    return undefined;
  }

  private isInWorkflowTemplateMetadata(
    document: TextDocument,
    position: Position
  ): boolean {
    let foundWorkflowTemplate = false;
    let foundMetadata = false;

    const startLine = Math.max(0, position.line - 20);
    
    for (let i = position.line; i >= startLine; i--) {
      const line = document.getText({
        start: { line: i, character: 0 },
        end: { line: i, character: Number.MAX_VALUE }
      });

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

  private extractWorkflowTemplateRef(
    document: TextDocument,
    position: Position
  ): string | undefined {
    const currentLine = document.getText({
      start: { line: position.line, character: 0 },
      end: { line: position.line, character: Number.MAX_VALUE }
    });

    if (!currentLine.includes("name:") || currentLine.includes("template:")) {
      return undefined;
    }

    const isInTemplateRef = this.isInTemplateRefBlock(document, position);
    if (!isInTemplateRef) {
      return undefined;
    }

    return this.extractTemplateName(document, position);
  }

  private isInTemplateRefBlock(
    document: TextDocument,
    position: Position
  ): boolean {
    const startLine = Math.max(0, position.line - 5);
    
    for (let i = position.line; i >= startLine; i--) {
      const line = document.getText({
        start: { line: i, character: 0 },
        end: { line: i, character: Number.MAX_VALUE }
      });
      if (line.includes("templateRef:")) {
        return true;
      }
      if (line.includes("- name:") && i < position.line) {
        return false;
      }
    }
    return false;
  }

  private async findTemplateInWorkflowTemplate(
    context: TemplateRefContext
  ): Promise<Location[]> {
    try {
      const searchResult = await this.templateSearchService.findTemplateInWorkflowTemplate(
        this.workspaceRoot,
        context.workflowTemplateName,
        context.templateName
      );

      return searchResult.locations.map(location => ({
        uri: `file://${location.file}`,
        range: {
          start: { line: location.line, character: 0 },
          end: { line: location.line, character: Number.MAX_VALUE }
        }
      }));
    } catch (error) {
      console.error("Error finding template in WorkflowTemplate:", error);
      return [];
    }
  }

  private async findWorkflowTemplate(templateName: string): Promise<Location[]> {
    try {
      const searchResult = await this.templateSearchService.findTemplateDefinition(
        this.workspaceRoot,
        templateName
      );

      return searchResult.locations.map(location => ({
        uri: `file://${location.file}`,
        range: {
          start: { line: location.line, character: 0 },
          end: { line: location.line, character: Number.MAX_VALUE }
        }
      }));
    } catch (error) {
      console.error("Error finding template definition:", error);
      return [];
    }
  }

  private async findTemplateReferences(
    templateContext: { workflowTemplateName: string; templateName: string }
  ): Promise<Location[]> {
    try {
      const searchResult = await this.templateSearchService.findTemplateReferences(
        this.workspaceRoot,
        templateContext.workflowTemplateName,
        templateContext.templateName
      );

      return searchResult.locations.map(location => ({
        uri: `file://${location.file}`,
        range: {
          start: { line: location.line, character: 0 },
          end: { line: location.line, character: Number.MAX_VALUE }
        }
      }));
    } catch (error) {
      console.error("Error finding template references:", error);
      return [];
    }
  }

  private async findWorkflowTemplateReferences(workflowTemplateName: string): Promise<Location[]> {
    try {
      const searchResult = await this.templateSearchService.findWorkflowTemplateReferences(
        this.workspaceRoot,
        workflowTemplateName
      );

      return searchResult.locations.map(location => ({
        uri: `file://${location.file}`,
        range: {
          start: { line: location.line, character: 0 },
          end: { line: location.line, character: Number.MAX_VALUE }
        }
      }));
    } catch (error) {
      console.error("Error finding WorkflowTemplate references:", error);
      return [];
    }
  }
}