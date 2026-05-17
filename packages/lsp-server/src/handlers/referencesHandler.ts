import {
  Location,
  ReferenceParams,
  TextDocuments
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  ArgoYamlNavigationTarget,
  ArgoYamlNavigationService,
  TemplateSearchService,
  TextDocumentReader,
  WorkflowTemplateLocation
} from '@uranus-yaml/core';

class LspDocumentReader implements TextDocumentReader {
  public readonly lineCount: number;

  constructor(private readonly document: TextDocument) {
    this.lineCount = document.lineCount;
  }

  public getLine(line: number): string {
    return this.document.getText({
      start: { line, character: 0 },
      end: { line, character: Number.MAX_VALUE }
    });
  }

  public getTextInRange(startLine: number, endLine: number): string {
    return this.document.getText({
      start: { line: startLine, character: 0 },
      end: { line: endLine, character: 0 }
    });
  }
}

export class ReferencesHandler {
  constructor(
    private readonly templateSearchService: TemplateSearchService,
    private readonly documents: TextDocuments<TextDocument>,
    private readonly workspaceRoot: string,
    private readonly navigationService = new ArgoYamlNavigationService()
  ) {}

  public async handleReferences(params: ReferenceParams): Promise<Location[]> {
    const document = this.documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }

    const target = this.navigationService.getNavigationTarget(
      new LspDocumentReader(document),
      params.position
    );

    if (!target) {
      return [];
    }

    return this.findReferences(target);
  }

  private findReferences(target: ArgoYamlNavigationTarget): Promise<Location[]> {
    switch (target.kind) {
      case 'templateDefinition':
      case 'templateReferences':
        return this.findTemplateReferences(
          target.workflowTemplateName,
          target.templateName
        );
      case 'workflowTemplateDefinition':
      case 'workflowTemplateReferences':
        return this.findWorkflowTemplateReferences(target.workflowTemplateName);
    }
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

      return this.toLocations(searchResult.locations);
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

      return this.toLocations(searchResult.locations);
    } catch (error) {
      console.error("Error finding WorkflowTemplate references:", error);
      return [];
    }
  }

  private toLocations(locations: readonly WorkflowTemplateLocation[]): Location[] {
    return locations.map((location) => ({
      uri: `file://${location.file}`,
      range: {
        start: { line: location.line, character: 0 },
        end: { line: location.line, character: Number.MAX_VALUE }
      }
    }));
  }
}
