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
  TemplateSearchService
} from '@uranus-yaml/core';
import { getDocumentFilePath } from '../documentCacheSync';
import { LspDocumentReader, toLspLocations } from './lspNavigationAdapter';

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

    return this.findReferences(target, getDocumentFilePath(document.uri));
  }

  private async findReferences(
    target: ArgoYamlNavigationTarget,
    sourceFilePath?: string
  ): Promise<Location[]> {
    try {
      const searchResult = await searchTargetReferences(
        this.templateSearchService,
        this.workspaceRoot,
        target,
        sourceFilePath
      );

      return toLspLocations(searchResult.locations);
    } catch (error) {
      console.error('Error resolving Argo YAML references:', error);
      return [];
    }
  }
}
