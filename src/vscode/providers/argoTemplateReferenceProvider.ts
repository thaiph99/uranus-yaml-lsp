import * as vscode from "vscode";
import { TemplateSearchService } from "../../core/services/templateSearchService";

/**
 * Reference provider for Argo WorkflowTemplate references in YAML files.
 * Enables "Find All References" functionality for template names.
 */
export class ArgoTemplateReferenceProvider implements vscode.ReferenceProvider {
  constructor(private readonly templateSearchService: TemplateSearchService) {}

  public async provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.ReferenceContext,
    token: vscode.CancellationToken
  ): Promise<vscode.Location[] | undefined> {
    if (token.isCancellationRequested) {
      return undefined;
    }

    console.log("ArgoTemplateReferenceProvider: provideReferences called");

    const workspaceFolder = this.getWorkspaceFolder();
    if (!workspaceFolder) {
      console.log("ArgoTemplateReferenceProvider: No workspace folder found");
      return undefined;
    }

    // Check if we're clicking on a template name within a WorkflowTemplate
    const templateContext = this.extractTemplateContext(document, position);
    if (!templateContext) {
      console.log("ArgoTemplateReferenceProvider: No template context found");
      return undefined;
    }

    console.log("ArgoTemplateReferenceProvider: Found template context:", templateContext);

    try {
      const searchResult = await this.templateSearchService.findTemplateReferences(
        workspaceFolder.uri.fsPath,
        templateContext.workflowTemplateName,
        templateContext.templateName
      );

      if (token.isCancellationRequested) {
        return undefined;
      }

      const locations = searchResult.locations.map(
        (location: any) =>
          new vscode.Location(
            vscode.Uri.file(location.file),
            new vscode.Position(location.line, 0)
          )
      );

      // Include the definition itself if requested
      if (context.includeDeclaration) {
        locations.unshift(
          new vscode.Location(
            document.uri,
            new vscode.Position(position.line, 0)
          )
        );
      }

      console.log("ArgoTemplateReferenceProvider: Found", locations.length, "references");

      if (locations.length > 0) {
        void vscode.window.showInformationMessage(
          `Found ${locations.length} reference(s) to template '${templateContext.templateName}' from WorkflowTemplate '${templateContext.workflowTemplateName}'`
        );
      } else {
        void vscode.window.showWarningMessage(
          `No references found for template '${templateContext.templateName}' from WorkflowTemplate '${templateContext.workflowTemplateName}'`
        );
      }

      return locations;
    } catch (error) {
      console.error("Error finding template references:", error);
      void vscode.window.showErrorMessage(`Error finding references: ${error}`);
      return undefined;
    }
  }

  private extractTemplateContext(
    document: vscode.TextDocument,
    position: vscode.Position
  ): { workflowTemplateName: string; templateName: string } | undefined {
    const currentLine = document.lineAt(position).text;

    // Check if we're on a line that contains a template name
    if (!currentLine.includes("name:")) {
      return undefined;
    }

    // More permissive check - look for any line with "name:" in a templates context
    const templateName = this.extractTemplateName(document, position);
    if (!templateName) {
      return undefined;
    }

    // Check if we're within a templates section of a WorkflowTemplate
    if (!this.isWithinTemplatesSection(document, position)) {
      return undefined;
    }

    // Find the WorkflowTemplate this template belongs to
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
    // Look backwards to find "templates:" section
    for (let i = position.line; i >= Math.max(0, position.line - 50); i--) {
      const line = document.lineAt(i).text;
      if (line.includes("templates:")) {
        return true;
      }
      // If we hit another major section, we're not in templates
      if (line.includes("kind:") || line.includes("apiVersion:")) {
        return false;
      }
    }
    return false;
  }

  private extractTemplateName(
    document: vscode.TextDocument,
    position: vscode.Position
  ): string | undefined {
    const line = document.lineAt(position).text;

    // Extract template name from any "name: templateName" pattern
    const nameMatch = line.match(/name:\s*['"]?([^'"#\s]+)['"]?\s*(?:#.*)?$/);
    if (nameMatch) {
      return nameMatch[1];
    }

    // Fallback: try to get word at cursor position
    const wordRange = document.getWordRangeAtPosition(position, /[\w-]/);
    if (wordRange) {
      const word = document.getText(wordRange);
      // Make sure it's a meaningful word
      if (word && word.length > 1) {
        return word;
      }
    }

    return undefined;
  }

  private findContainingWorkflowTemplate(
    document: vscode.TextDocument,
    position: vscode.Position
  ): string | undefined {
    // Look backwards from current position to find the WorkflowTemplate metadata
    for (let i = position.line; i >= 0; i--) {
      const line = document.lineAt(i).text;

      // Found the WorkflowTemplate kind
      if (line.includes("kind: WorkflowTemplate")) {
        // Look forward to find the name in metadata section
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

  private getWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    return workspaceFolders?.[0];
  }
}