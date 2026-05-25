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

type DefinitionNavigationTarget = Extract<
  ArgoYamlNavigationTarget,
  {
    readonly kind:
      | 'templateDefinition'
      | 'localTemplateDefinition'
      | 'dagTaskDefinition'
      | 'workflowTemplateDefinition'
  }
>;

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

    const documentReader = new LspDocumentReader(document);
    const target = this.navigationService.getNavigationTarget(
      documentReader,
      params.position
    );

    if (!target) {
      return null;
    }

    if (!this.isDefinitionTarget(target)) {
      return [this.toCurrentNameLocation(params, documentReader, target)];
    }

    return this.findDefinitionLocations(target);
  }

  private isDefinitionTarget(
    target: ArgoYamlNavigationTarget
  ): target is DefinitionNavigationTarget {
    return (
      target.kind === 'templateDefinition' ||
      target.kind === 'localTemplateDefinition' ||
      target.kind === 'dagTaskDefinition' ||
      target.kind === 'workflowTemplateDefinition'
    );
  }

  private async findDefinitionLocations(target: DefinitionNavigationTarget): Promise<Location[]> {
    try {
      const searchResult = await this.searchDefinitions(target);
      return this.toLocations(searchResult.locations);
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

  private searchDefinitions(target: DefinitionNavigationTarget): Promise<TemplateSearchResult> {
    switch (target.kind) {
      case 'templateDefinition':
        return this.templateSearchService.findTemplateInWorkflowTemplate(
          this.workspaceRoot,
          target.workflowTemplateName,
          target.templateName,
          target.clusterScope ?? false
        );
      case 'localTemplateDefinition':
        return this.templateSearchService.findTemplateInArgoResource(
          this.workspaceRoot,
          target.resourceName,
          target.templateName
        );
      case 'dagTaskDefinition':
        return this.templateSearchService.findDagTaskDefinition(
          this.workspaceRoot,
          target.resourceName,
          target.templateName,
          target.taskName
        );
      case 'workflowTemplateDefinition':
        return this.templateSearchService.findTemplateDefinition(
          this.workspaceRoot,
          target.workflowTemplateName,
          target.clusterScope ?? false
        );
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
