import * as vscode from "vscode";
import {
  ArgoYamlNavigationService,
  ArgoYamlNavigationTarget,
  DefinitionNavigationTarget,
  isDefinitionNavigationTarget,
  searchTargetDefinition,
  searchTargetReferences,
  TemplateSearchService,
  TextDocumentReader,
  WorkflowTemplateLocation
} from "@uranus-yaml/core";

class VsCodeDocumentReader implements TextDocumentReader {
  public readonly lineCount: number;

  constructor(private readonly document: vscode.TextDocument) {
    this.lineCount = document.lineCount;
  }

  public getLine(line: number): string {
    return this.document.lineAt(line).text;
  }

}

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
    if (token.isCancellationRequested) {
      return undefined;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return undefined;
    }

    const target = this.navigationService.getNavigationTarget(
      new VsCodeDocumentReader(document),
      position
    );

    if (!target) {
      return undefined;
    }

    if (!isDefinitionNavigationTarget(target)) {
      return new vscode.Location(document.uri, position);
    }

    return this.findLocations(workspaceFolder.uri.fsPath, target, token);
  }

  public async provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.ReferenceContext,
    token: vscode.CancellationToken
  ): Promise<vscode.Location[] | undefined> {
    if (token.isCancellationRequested) {
      return undefined;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return undefined;
    }

    const target = this.navigationService.getNavigationTarget(
      new VsCodeDocumentReader(document),
      position
    );
    if (!target) {
      return undefined;
    }

    return this.findReferenceLocations(workspaceFolder.uri.fsPath, target, token);
  }

  private async findLocations(
    rootPath: string,
    target: DefinitionNavigationTarget,
    token: vscode.CancellationToken
  ): Promise<vscode.Location[] | undefined> {
    try {
      const searchResult = await searchTargetDefinition(this.templateSearchService, rootPath, target);
      if (token.isCancellationRequested || searchResult.locations.length === 0) {
        return undefined;
      }

      return this.toVsCodeLocations(searchResult.locations);
    } catch (error) {
      console.error("Error resolving Argo YAML navigation:", error);
      return undefined;
    }
  }

  private async findReferenceLocations(
    rootPath: string,
    target: ArgoYamlNavigationTarget,
    token: vscode.CancellationToken
  ): Promise<vscode.Location[] | undefined> {
    try {
      const searchResult = await searchTargetReferences(this.templateSearchService, rootPath, target);
      if (token.isCancellationRequested || searchResult.locations.length === 0) {
        return undefined;
      }

      return this.toVsCodeLocations(searchResult.locations);
    } catch (error) {
      console.error("Error finding Argo YAML references:", error);
      return undefined;
    }
  }

  private toVsCodeLocations(
    locations: readonly WorkflowTemplateLocation[]
  ): vscode.Location[] {
    return locations.map(
      (location) =>
        new vscode.Location(
          vscode.Uri.file(location.file),
          new vscode.Position(location.line, location.character)
        )
    );
  }
}
