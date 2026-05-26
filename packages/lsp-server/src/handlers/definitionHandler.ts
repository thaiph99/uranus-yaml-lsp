import {
  DefinitionParams,
  Location,
  TextDocuments
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  ArgoYamlNavigationService,
  ArgoYamlNavigationTarget,
  DefinitionNavigationTarget,
  isDefinitionNavigationTarget,
  searchTargetDefinition,
  TemplateSearchService,
  TextDocumentReader
} from '@uranus-yaml/core';
import { LspDocumentReader, toLspLocations } from './lspNavigationAdapter';

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

    const documentReader = new LspDocumentReader(document);
    const target = this.navigationService.getNavigationTarget(
      documentReader,
      params.position
    );

    if (!target) {
      return null;
    }

    if (!isDefinitionNavigationTarget(target)) {
      return [this.toCurrentNameLocation(params, documentReader, target)];
    }

    return this.findDefinitionLocations(target);
  }

  private async findDefinitionLocations(target: DefinitionNavigationTarget): Promise<Location[]> {
    try {
      const searchResult = await searchTargetDefinition(this.templateSearchService, this.workspaceRoot, target);
      return toLspLocations(searchResult.locations);
    } catch (error) {
      console.error("Error resolving Argo YAML definition:", error);
      return [];
    }
  }

  private toCurrentNameLocation(
    params: DefinitionParams,
    document: TextDocumentReader,
    target: ArgoYamlNavigationTarget
  ): Location {
    const line = document.getLine(params.position.line);
    const name = this.getTargetName(target);
    const character = this.findNameStartCharacter(line, name) ?? params.position.character;
    const position = { line: params.position.line, character };

    return {
      uri: params.textDocument.uri,
      range: {
        start: position,
        end: position
      }
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

  private findNameStartCharacter(line: string, expectedValue: string): number | undefined {
    const match = line.match(/name:\s*['"]?([^'"#\s]+)['"]?\s*(?:#.*)?$/);
    if (!match || match.index === undefined || match[1] !== expectedValue) {
      return undefined;
    }

    const colonIndex = match[0].indexOf(':');
    const characterInMatch = match[0].indexOf(expectedValue, colonIndex + 1);
    if (characterInMatch === -1) {
      return undefined;
    }

    return match.index + characterInMatch;
  }
}
