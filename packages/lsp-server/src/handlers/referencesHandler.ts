import {
  ReferenceParams,
  Location,
  TextDocuments
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { TemplateSearchService } from '@uranus-yaml/core';

export class ReferencesHandler {
  constructor(
    private templateSearchService: TemplateSearchService,
    private documents: TextDocuments<TextDocument>,
    private workspaceRoot: string
  ) {}

  async handleReferences(params: ReferenceParams): Promise<Location[]> {
    const document = this.documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }

    const position = params.position;
    const templateName = this.extractTemplateName(document, position);
    
    if (!templateName) {
      return [];
    }

    // Try to find the containing WorkflowTemplate
    const workflowTemplateName = this.findContainingWorkflowTemplate(document, position);
    
    if (workflowTemplateName) {
      // If we found a WorkflowTemplate context, search for references to this specific template
      return this.findTemplateReferences(workflowTemplateName, templateName);
    } else {
      // Otherwise, search for general WorkflowTemplate references
      return this.findWorkflowTemplateReferences(templateName);
    }
  }

  private extractTemplateName(
    document: TextDocument,
    position: { line: number; character: number }
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

  private findContainingWorkflowTemplate(
    document: TextDocument,
    position: { line: number; character: number }
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

  private async findTemplateReferences(
    workflowTemplateName: string,
    templateName: string
  ): Promise<Location[]> {
    try {
      const searchResult = await this.templateSearchService.findTemplateReferences(
        this.workspaceRoot,
        workflowTemplateName,
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
      console.error("Error finding template references:", error);
      return [];
    }
  }

  private async findWorkflowTemplateReferences(templateName: string): Promise<Location[]> {
    try {
      const searchResult = await this.templateSearchService.findWorkflowTemplateReferences(
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
      console.error("Error finding WorkflowTemplate references:", error);
      return [];
    }
  }
}