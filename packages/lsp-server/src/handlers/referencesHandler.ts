import {
  Location,
  ReferenceParams,
  TextDocuments
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  ArgoYamlNavigationTarget,
  ArgoYamlNavigationService,
  searchTargetReferences,
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

  private async findReferences(target: ArgoYamlNavigationTarget): Promise<Location[]> {
    try {
      const searchResult = await searchTargetReferences(
        this.templateSearchService,
        this.workspaceRoot,
        target
      );

      return this.toLocations(searchResult.locations);
    } catch (error) {
      console.error('Error resolving Argo YAML references:', error);
      return [];
    }
  }

  private toLocations(locations: readonly WorkflowTemplateLocation[]): Location[] {
    return locations.map((location) => ({
      uri: `file://${location.file}`,
      range: {
        start: { line: location.line, character: location.character },
        end: { line: location.line, character: location.character }
      }
    }));
  }
}
