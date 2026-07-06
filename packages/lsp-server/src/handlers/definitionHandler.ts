import {
  DefinitionParams,
  Location,
  TextDocuments
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  ArgoYamlNavigationService,
  ArgoYamlNavigationTarget,
  getKeyValueRange,
  isDefinitionNavigationTarget,
  searchTargetDefinition,
  TemplateSearchService
} from '@uranus-yaml/core';
import { toLspLocations } from './lspNavigationAdapter';

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

    const lines = document.getText().split('\n');
    const target = this.navigationService.getNavigationTarget(lines, params.position);
    if (!target) {
      return null;
    }

    // On a definition line itself, stay at the name instead of searching.
    if (!isDefinitionNavigationTarget(target)) {
      return [this.toCurrentNameLocation(params, lines[params.position.line], target)];
    }

    try {
      const result = await searchTargetDefinition(this.templateSearchService, this.workspaceRoot, target);
      return toLspLocations(result.locations);
    } catch (error) {
      console.error('Error resolving Argo YAML definition:', error);
      return [];
    }
  }

  private toCurrentNameLocation(
    params: DefinitionParams,
    line: string,
    target: ArgoYamlNavigationTarget
  ): Location {
    const character = getKeyValueRange(line, 'name', this.getTargetName(target))?.character
      ?? params.position.character;
    const position = { line: params.position.line, character };

    return {
      uri: params.textDocument.uri,
      range: { start: position, end: position }
    };
  }

  private getTargetName(target: ArgoYamlNavigationTarget): string {
    switch (target.kind) {
      case 'templateDefinition':
      case 'templateReferences':
      case 'localTemplateDefinition':
      case 'localTemplateReferences':
        return target.templateName;
      case 'dagTaskDefinition':
      case 'dagTaskReferences':
        return target.taskName;
      case 'workflowTemplateDefinition':
      case 'workflowTemplateReferences':
        return target.workflowTemplateName;
    }
  }
}
