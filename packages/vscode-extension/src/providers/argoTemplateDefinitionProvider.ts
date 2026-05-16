import * as vscode from "vscode";
import {
  TemplateSearchService,
  TemplateRefContext,
  WorkflowTemplateLocation
} from "@uranus-yaml/core";

export class ArgoTemplateDefinitionProvider implements vscode.DefinitionProvider {
  constructor(private readonly templateSearchService: TemplateSearchService) {}

  public async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Location | vscode.Location[] | undefined> {
    if (token.isCancellationRequested) {
      return undefined;
    }

    const line = document.lineAt(position).text;
    if (!this.isNameReference(line)) {
      return undefined;
    }

    const workspaceFolder = this.getWorkspaceFolder();
    if (!workspaceFolder) {
      return undefined;
    }

    // Check if we're clicking on a template definition (in a WorkflowTemplate)
    const templateDefinitionContext = this.extractTemplateDefinitionContext(document, position);
    if (templateDefinitionContext) {
      return this.findTemplateReferences(
        workspaceFolder.uri.fsPath,
        templateDefinitionContext,
        token
      );
    }

    // Check if we're clicking on a WorkflowTemplate name definition
    const workflowTemplateDefinitionContext = this.extractWorkflowTemplateDefinitionContext(document, position);
    if (workflowTemplateDefinitionContext) {
      return this.findWorkflowTemplateReferences(
        workspaceFolder.uri.fsPath,
        workflowTemplateDefinitionContext,
        token
      );
    }

    // Check if we're in a templateRef context
    const templateRefContext = this.extractTemplateRefContext(document, position);

    if (templateRefContext) {
      return this.findTemplateInWorkflowTemplate(
        workspaceFolder.uri.fsPath,
        templateRefContext,
        token
      );
    }

    // Check if we're clicking on a name in a templateRef block (WorkflowTemplate reference)
    const workflowTemplateRef = this.extractWorkflowTemplateRef(document, position);
    if (workflowTemplateRef) {
      return this.findWorkflowTemplate(
        workspaceFolder.uri.fsPath,
        workflowTemplateRef,
        token
      );
    }

    // Original functionality - try to extract any template name for general search
    const templateName = this.extractTemplateName(document, position);
    if (!templateName || templateName.length < 2) {
      return undefined;
    }

    return this.findWorkflowTemplate(
      workspaceFolder.uri.fsPath,
      templateName,
      token
    );
  }

  private isNameReference(line: string): boolean {
    return (
      line.includes("name:") ||
      line.includes("template:")
    );
  }

  private extractTemplateRefContext(
    document: vscode.TextDocument,
    position: vscode.Position
  ): TemplateRefContext | undefined {
    const currentLine = document.lineAt(position).text;

    if (!currentLine.includes("template:")) {
      return undefined;
    }

    const templateName = this.extractTemplateName(document, position);
    if (!templateName) {
      return undefined;
    }

    const workflowTemplateName = this.findWorkflowTemplateNameInTemplateRef(document, position);
    if (!workflowTemplateName) {
      return undefined;
    }

    return {
      workflowTemplateName,
      templateName
    };
  }

  private findWorkflowTemplateNameInTemplateRef(
    document: vscode.TextDocument,
    position: vscode.Position
  ): string | undefined {
    for (let i = position.line; i >= Math.max(0, position.line - 15); i--) {
      const line = document.lineAt(i).text;

      if (line.includes("templateRef:")) {
        for (let j = i + 1; j <= Math.min(document.lineCount - 1, position.line + 3); j++) {
          const nameCandidate = document.lineAt(j).text;
          if (nameCandidate.includes("name:") && !nameCandidate.includes("template:")) {
            const nameMatch = nameCandidate.match(/name:\s*['"]?([^'"#\s]+)['"]?\s*(?:#.*)?$/);
            if (nameMatch) {
              return nameMatch[1];
            }
          }
        }
      }
    }
    return undefined;
  }

  private async findTemplateInWorkflowTemplate(
    rootPath: string,
    context: TemplateRefContext,
    token: vscode.CancellationToken
  ): Promise<vscode.Location | vscode.Location[] | undefined> {
    if (token.isCancellationRequested) {
      return undefined;
    }

    try {
      const searchResult = await this.templateSearchService.findTemplateInWorkflowTemplate(
        rootPath,
        context.workflowTemplateName,
        context.templateName
      );

      if (token.isCancellationRequested) {
        return undefined;
      }

      if (searchResult.locations.length === 0) {
        return undefined;
      }

      return this.toVsCodeLocations(searchResult.locations);
    } catch (error) {
      console.error("Error finding template in WorkflowTemplate:", error);
      return undefined;
    }
  }

  private async findWorkflowTemplate(
    rootPath: string,
    templateName: string,
    token: vscode.CancellationToken
  ): Promise<vscode.Location | vscode.Location[] | undefined> {
    if (token.isCancellationRequested) {
      return undefined;
    }

    try {
      const searchResult = await this.templateSearchService.findTemplateDefinition(
        rootPath,
        templateName
      );

      if (token.isCancellationRequested) {
        return undefined;
      }

      if (searchResult.locations.length === 0) {
        return undefined;
      }

      return this.toVsCodeLocations(searchResult.locations);
    } catch (error) {
      console.error("Error finding template definition:", error);
      return undefined;
    }
  }

  private extractTemplateName(
    document: vscode.TextDocument,
    position: vscode.Position
  ): string | undefined {
    const line = document.lineAt(position).text;

    const wordRange = document.getWordRangeAtPosition(
      position,
      /[\w-]+/
    );

    if (wordRange) {
      const word = document.getText(wordRange);
      if (word && word.length > 0 && /[\w-]/.test(word)) {
        return word;
      }
    }

    if (line.includes("name:")) {
      const nameMatch = line.match(/name:\s*['"]?([^'"#\s]+)['"]?\s*(?:#.*)?$/);
      if (nameMatch) {
        return nameMatch[1];
      }
    }

    if (line.includes("template:")) {
      const templateMatch = line.match(/template:\s*['"]?([^'"#\s]+)['"]?\s*(?:#.*)?$/);
      if (templateMatch) {
        return templateMatch[1];
      }
    }

    return undefined;
  }

  private extractWorkflowTemplateRef(
    document: vscode.TextDocument,
    position: vscode.Position
  ): string | undefined {
    const currentLine = document.lineAt(position).text;

    if (!currentLine.includes("name:") || currentLine.includes("template:")) {
      return undefined;
    }

    const isInTemplateRef = this.isInTemplateRefBlock(document, position);
    if (!isInTemplateRef) {
      return undefined;
    }

    return this.extractTemplateName(document, position);
  }

  private isInTemplateRefBlock(
    document: vscode.TextDocument,
    position: vscode.Position
  ): boolean {
    for (let i = position.line; i >= Math.max(0, position.line - 5); i--) {
      const line = document.lineAt(i).text;
      if (line.includes("templateRef:")) {
        return true;
      }
      if (line.includes("- name:") && i < position.line) {
        return false;
      }
    }
    return false;
  }

  private getWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    return workspaceFolders?.[0];
  }

  private extractTemplateDefinitionContext(
    document: vscode.TextDocument,
    position: vscode.Position
  ): { workflowTemplateName: string; templateName: string } | undefined {
    const currentLine = document.lineAt(position).text;

    if (!currentLine.includes("name:")) {
      return undefined;
    }

    const templateNameMatch = currentLine.match(/^\s*-\s+name:\s*(.+)$/);
    if (!templateNameMatch) {
      return undefined;
    }

    if (!this.isWithinTemplatesSection(document, position)) {
      return undefined;
    }

    const templateName = this.extractTemplateName(document, position);
    if (!templateName) {
      return undefined;
    }

    const workflowTemplateName = this.findContainingWorkflowTemplate(document, position);
    if (!workflowTemplateName) {
      return undefined;
    }

    return {
      workflowTemplateName,
      templateName
    };
  }

  private isWithinTemplatesSection(
    document: vscode.TextDocument,
    position: vscode.Position
  ): boolean {
    for (let i = position.line; i >= Math.max(0, position.line - 50); i--) {
      const line = document.lineAt(i).text;
      if (line.includes("templates:")) {
        return true;
      }
      if (line.includes("kind:") || line.includes("apiVersion:")) {
        return false;
      }
    }
    return false;
  }

  private findContainingWorkflowTemplate(
    document: vscode.TextDocument,
    position: vscode.Position
  ): string | undefined {
    for (let i = position.line; i >= 0; i--) {
      const line = document.lineAt(i).text;

      if (line.includes("kind: WorkflowTemplate")) {
        for (let j = i; j < Math.min(document.lineCount, i + 20); j++) {
          const metadataLine = document.lineAt(j).text;
          if (metadataLine.includes("name:") &&
              j > i) {
            const nameMatch = metadataLine.match(/name:\s*['"]?([^'"#\s]+)['"]?\s*(?:#.*)?$/);
            if (nameMatch) {
              return nameMatch[1];
            }
          }
        }
      }
    }
    return undefined;
  }

  private async findTemplateReferences(
    rootPath: string,
    templateContext: { workflowTemplateName: string; templateName: string },
    token: vscode.CancellationToken
  ): Promise<vscode.Location[] | undefined> {
    if (token.isCancellationRequested) {
      return undefined;
    }

    try {
      const searchResult = await this.templateSearchService.findTemplateReferences(
        rootPath,
        templateContext.workflowTemplateName,
        templateContext.templateName
      );

      if (token.isCancellationRequested) {
        return undefined;
      }

      const locations = this.toVsCodeLocations(searchResult.locations);

      return locations;
    } catch (error) {
      console.error("Error finding template references:", error);
      return undefined;
    }
  }

  private extractWorkflowTemplateDefinitionContext(
    document: vscode.TextDocument,
    position: vscode.Position
  ): string | undefined {
    const currentLine = document.lineAt(position).text;

    if (!currentLine.includes("name:")) {
      return undefined;
    }

    if (!this.isInWorkflowTemplateMetadata(document, position)) {
      return undefined;
    }

    const nameMatch = currentLine.match(/name:\s*['"]?([^'"#\s]+)['"]?\s*(?:#.*)?$/);
    if (nameMatch) {
      return nameMatch[1];
    }

    return undefined;
  }

  private isInWorkflowTemplateMetadata(
    document: vscode.TextDocument,
    position: vscode.Position
  ): boolean {
    let foundWorkflowTemplate = false;
    let foundMetadata = false;

    for (let i = position.line; i >= Math.max(0, position.line - 20); i--) {
      const line = document.lineAt(i).text;

      if (line.includes("metadata:")) {
        foundMetadata = true;
      }

      if (line.includes("kind: WorkflowTemplate")) {
        foundWorkflowTemplate = true;
        break;
      }

      if (line.includes("spec:") || line.includes("status:")) {
        return false;
      }
    }

    return foundWorkflowTemplate && foundMetadata;
  }

  private async findWorkflowTemplateReferences(
    rootPath: string,
    workflowTemplateName: string,
    token: vscode.CancellationToken
  ): Promise<vscode.Location[] | undefined> {
    if (token.isCancellationRequested) {
      return undefined;
    }

    try {
      const searchResult = await this.templateSearchService.findWorkflowTemplateReferences(
        rootPath,
        workflowTemplateName
      );

      if (token.isCancellationRequested) {
        return undefined;
      }

      const locations = this.toVsCodeLocations(searchResult.locations);

      return locations;
    } catch (error) {
      console.error("Error finding WorkflowTemplate references:", error);
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
          new vscode.Position(location.line, 0)
        )
    );
  }
}
