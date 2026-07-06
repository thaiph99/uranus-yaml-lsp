import * as vscode from "vscode";
import {
  ArgoYamlNavigationService,
  ArgoYamlNavigationTarget,
  isDefinitionNavigationTarget,
  searchTargetDefinition,
  searchTargetReferences,
  TemplateSearchService,
  TemplateSearchResult
} from "@uranus-yaml/core";

export class ArgoYamlDefinitionProvider implements vscode.DefinitionProvider, vscode.ReferenceProvider {
  constructor(
    private readonly templateSearchService: TemplateSearchService,
    private readonly navigationService = new ArgoYamlNavigationService()
  ) {}

  public async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Location | vscode.Location[] | undefined> {
    const rootPath = this.getRootPath(token);
    if (!rootPath) {
      return undefined;
    }

    const target = this.getTarget(document, position);
    if (!target) {
      return undefined;
    }

    // On a definition line itself, stay at the current position.
    if (!isDefinitionNavigationTarget(target)) {
      return new vscode.Location(document.uri, position);
    }

    return this.toLocations(
      searchTargetDefinition(this.templateSearchService, rootPath, target),
      token
    );
  }

  public async provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.ReferenceContext,
    token: vscode.CancellationToken
  ): Promise<vscode.Location[] | undefined> {
    const rootPath = this.getRootPath(token);
    if (!rootPath) {
      return undefined;
    }

    const target = this.getTarget(document, position);
    if (!target) {
      return undefined;
    }

    return this.toLocations(
      searchTargetReferences(this.templateSearchService, rootPath, target, document.uri.fsPath),
      token
    );
  }

  private getRootPath(token: vscode.CancellationToken): string | undefined {
    return token.isCancellationRequested
      ? undefined
      : vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  private getTarget(
    document: vscode.TextDocument,
    position: vscode.Position
  ): ArgoYamlNavigationTarget | undefined {
    return this.navigationService.getNavigationTarget(document.getText().split("\n"), position);
  }

  private async toLocations(
    search: Promise<TemplateSearchResult>,
    token: vscode.CancellationToken
  ): Promise<vscode.Location[] | undefined> {
    try {
      const { locations } = await search;
      if (token.isCancellationRequested || locations.length === 0) {
        return undefined;
      }

      return locations.map((location) => new vscode.Location(
        vscode.Uri.file(location.file),
        new vscode.Position(location.line, location.character)
      ));
    } catch (error) {
      console.error("Error resolving Argo YAML navigation:", error);
      return undefined;
    }
  }
}
