import {
  Location,
  ReferenceParams,
  TextDocuments
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  ArgoYamlNavigationService,
  searchTargetReferences,
  TemplateSearchService
} from '@uranus-yaml/core';
import { getDocumentFilePath } from '../documentCacheSync';
import { toLspLocations } from './lspNavigationAdapter';

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
      document.getText().split('\n'),
      params.position
    );
    if (!target) {
      return [];
    }

    try {
      const result = await searchTargetReferences(
        this.templateSearchService,
        this.workspaceRoot,
        target,
        getDocumentFilePath(document.uri)
      );
      return toLspLocations(result.locations);
    } catch (error) {
      console.error('Error resolving Argo YAML references:', error);
      return [];
    }
  }
}
