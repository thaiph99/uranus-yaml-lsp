import * as vscode from "vscode";
import {
  ArgoYamlNavigationService,
  ArgoYamlNavigationTarget,
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

  public getTextInRange(startLine: number, endLine: number): string {
    return this.document.getText(
      new vscode.Range(startLine, 0, endLine, 0)
    );
  }
}

export class ArgoYamlDefinitionProvider implements vscode.DefinitionProvider {
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

    return this.findLocations(workspaceFolder.uri.fsPath, target, token);
  }

  private async findLocations(
    rootPath: string,
    target: ArgoYamlNavigationTarget,
    token: vscode.CancellationToken
  ): Promise<vscode.Location[] | undefined> {
    try {
      const searchResult = await this.search(rootPath, target);
      if (token.isCancellationRequested || searchResult.locations.length === 0) {
        return undefined;
      }

      return this.toVsCodeLocations(searchResult.locations);
    } catch (error) {
      console.error("Error resolving Argo YAML navigation:", error);
      return undefined;
    }
  }

  private search(rootPath: string, target: ArgoYamlNavigationTarget) {
    switch (target.kind) {
      case "templateDefinition":
        return this.templateSearchService.findTemplateInWorkflowTemplate(
          rootPath,
          target.workflowTemplateName,
          target.templateName
        );
      case "workflowTemplateDefinition":
        return this.templateSearchService.findTemplateDefinition(
          rootPath,
          target.workflowTemplateName
        );
      case "templateReferences":
        return this.templateSearchService.findTemplateReferences(
          rootPath,
          target.workflowTemplateName,
          target.templateName
        );
      case "workflowTemplateReferences":
        return this.templateSearchService.findWorkflowTemplateReferences(
          rootPath,
          target.workflowTemplateName
        );
    }
  }

  private toVsCodeLocations(
    locations: readonly WorkflowTemplateLocation[]
  ): vscode.Location[] {
    return locations.map(
      (location) =>
        new vscode.Location(
          vscode.Uri.file(location.file),
          new vscode.Position(location.line, 0)
        )
    );
  }
}
