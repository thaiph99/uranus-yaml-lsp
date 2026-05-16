import {
  DefinitionParams,
  Location,
  TextDocuments
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  ArgoYamlNavigationService,
  ArgoYamlNavigationTarget,
  TemplateSearchResult,
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

export class DefinitionHandler {
  constructor(
    private readonly templateSearchService: TemplateSearchService,
    private readonly documents: TextDocuments<TextDocument>,
    private readonly workspaceRoot: string,
    private readonly navigationService = new ArgoYamlNavigationService()
  ) {}

  public async handleDefinition(params: DefinitionParams): Promise<Location[] | null> {
    const document = this.documents.get(params.textDocument.uri);
    if (!document) {
      return null;
    }

    const target = this.navigationService.getNavigationTarget(
      new LspDocumentReader(document),
      params.position
    );

    if (!target) {
      return null;
    }

    
    return this.findLocations(target);
  }

  private async findLocations(target: ArgoYamlNavigationTarget): Promise<Location[]> {
    try {
      const searchResult = await this.search(target);
      return this.toLocations(searchResult.locations);
    } catch (error) {
      console.error("Error resolving Argo YAML definition:", error);
      return [];
    }
  }

  private search(target: ArgoYamlNavigationTarget): Promise<TemplateSearchResult> {
    switch (target.kind) {
      case 'templateDefinition':
        return this.templateSearchService.findTemplateInWorkflowTemplate(
          this.workspaceRoot,
          target.workflowTemplateName,
          target.templateName
        );
      case 'workflowTemplateDefinition':
        return this.templateSearchService.findTemplateDefinition(
          this.workspaceRoot,
          target.workflowTemplateName
        );
      case 'templateReferences':
        return this.templateSearchService.findTemplateReferences(
          this.workspaceRoot,
          target.workflowTemplateName,
          target.templateName
        );
      case 'workflowTemplateReferences':
        return this.templateSearchService.findWorkflowTemplateReferences(
          this.workspaceRoot,
          target.workflowTemplateName
        );
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
