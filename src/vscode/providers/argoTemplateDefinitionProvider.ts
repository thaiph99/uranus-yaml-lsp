import * as vscode from "vscode";
import { TemplateSearchService } from "../../core/services/templateSearchService";
import { TemplateRefContext } from "../../core/types/index";

/**
 * Definition provider for Argo WorkflowTemplate references in YAML files.
 * Enables Ctrl+Click navigation to template definitions and find references.
 */
export class ArgoTemplateDefinitionProvider
  implements vscode.DefinitionProvider
{
  constructor(private readonly templateSearchService: TemplateSearchService) {}

  public async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Location | vscode.Location[] | undefined> {
    // Early exit checks
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
      // Show references instead of definition
      return this.findTemplateReferences(
        workspaceFolder.uri.fsPath,
        templateDefinitionContext,
        token
      );
    }

    // Check if we're clicking on a WorkflowTemplate name definition
    const workflowTemplateDefinitionContext = this.extractWorkflowTemplateDefinitionContext(document, position);
    if (workflowTemplateDefinitionContext) {
      // Show all references to this WorkflowTemplate
      return this.findWorkflowTemplateReferences(
        workspaceFolder.uri.fsPath,
        workflowTemplateDefinitionContext,
        token
      );
    }

    // Check if we're in a templateRef context
    const templateRefContext = this.extractTemplateRefContext(document, position);

    if (templateRefContext) {
      // Search for specific template within WorkflowTemplate
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
    // Look for template references or name declarations
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

    // Check if we're on a "template:" line within a templateRef block
    if (!currentLine.includes("template:")) {
      return undefined;
    }

    // Extract the template name from current line
    const templateName = this.extractTemplateName(document, position);
    if (!templateName) {
      return undefined;
    }

    // Look backwards to find the templateRef block and extract the WorkflowTemplate name
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
    // Look backwards from current position to find the templateRef block
    for (let i = position.line; i >= Math.max(0, position.line - 15); i--) {
      const line = document.lineAt(i).text;

      // Check if this is the templateRef block start
      if (line.includes("templateRef:")) {
        // Look forward from templateRef to find the name (should be the next few lines)
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
        void vscode.window.showWarningMessage(
          `Template '${context.templateName}' not found in WorkflowTemplate '${context.workflowTemplateName}'.`
        );
        return undefined;
      }

      return searchResult.locations.map(
        (location: any) =>
          new vscode.Location(
            vscode.Uri.file(location.file),
            new vscode.Position(location.line, 0)
          )
      );
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
        // Don't show warning for common cases to avoid spam
        if (templateName !== "main" && templateName !== "default") {
          void vscode.window.showWarningMessage(
            `WorkflowTemplate '${templateName}' not found.`
          );
        }
        return undefined;
      }

      // Only show success message if more than one result to avoid spam
      if (searchResult.locations.length > 1) {
        void vscode.window.showInformationMessage(
          `Found ${searchResult.locations.length} WorkflowTemplate definitions for '${templateName}'`
        );
      }

      return searchResult.locations.map(
        (location: any) =>
          new vscode.Location(
            vscode.Uri.file(location.file),
            new vscode.Position(location.line, 0)
          )
      );
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

    // First try to get the word at the cursor position
    const wordRange = document.getWordRangeAtPosition(
      position,
      /[\w-]+/);

    if (wordRange) {
      const word = document.getText(wordRange);
      // Make sure we got a meaningful word (not just punctuation)
      if (word && word.length > 0 && /[\w-]/.test(word)) {
        return word;
      }
    }

    // Fallback: extract from the line using regex
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

    // Check if we're on a "name:" line within a templateRef block
    if (!currentLine.includes("name:") || currentLine.includes("template:")) {
      return undefined;
    }

    // Check if we're within a templateRef block
    const isInTemplateRef = this.isInTemplateRefBlock(document, position);
    if (!isInTemplateRef) {
      return undefined;
    }

    // Extract the WorkflowTemplate name from current line
    return this.extractTemplateName(document, position);
  }

  private isInTemplateRefBlock(
    document: vscode.TextDocument,
    position: vscode.Position
  ): boolean {
    // Look backwards to see if we're within a templateRef block
    for (let i = position.line; i >= Math.max(0, position.line - 5); i--) {
      const line = document.lineAt(i).text;
      if (line.includes("templateRef:")) {
        return true;
      }
      // If we hit another block or step, we're not in a templateRef
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

    // Check if we're on a line that contains a template name in a WorkflowTemplate definition
    if (!currentLine.includes("name:")) {
      return undefined;
    }

    // Check if this is a template definition (- name: templateName in templates section)
    const templateNameMatch = currentLine.match(/^\s*-\s+name:\s*(.+)$/);
    if (!templateNameMatch) {
      return undefined;
    }

    // Check if we're within a templates section of a WorkflowTemplate
    if (!this.isWithinTemplatesSection(document, position)) {
      return undefined;
    }

    // Extract the template name
    const templateName = this.extractTemplateName(document, position);
    if (!templateName) {
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

      const locations = searchResult.locations.map(
        (location: any) =>
          new vscode.Location(
            vscode.Uri.file(location.file),
            new vscode.Position(location.line, 0)
          )
      );

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

  private extractWorkflowTemplateDefinitionContext(
    document: vscode.TextDocument,
    position: vscode.Position
  ): string | undefined {
    const currentLine = document.lineAt(position).text;

    // Check if we're on a line that contains a name in metadata section
    if (!currentLine.includes("name:")) {
      return undefined;
    }

    // Check if we're in a WorkflowTemplate metadata section
    if (!this.isInWorkflowTemplateMetadata(document, position)) {
      return undefined;
    }

    // Extract the WorkflowTemplate name
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
    // Look backwards to check if we're in a WorkflowTemplate metadata section
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

      // If we hit spec: or another major section before metadata, we're not in the right place
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

      const locations = searchResult.locations.map(
        (location: any) =>
          new vscode.Location(
            vscode.Uri.file(location.file),
            new vscode.Position(location.line, 0)
          )
      );

      if (locations.length > 0) {
        void vscode.window.showInformationMessage(
          `Found ${locations.length} reference(s) to WorkflowTemplate '${workflowTemplateName}'`
        );
      } else {
        void vscode.window.showWarningMessage(
          `No references found for WorkflowTemplate '${workflowTemplateName}'`
        );
      }

      return locations;
    } catch (error) {
      console.error("Error finding WorkflowTemplate references:", error);
      void vscode.window.showErrorMessage(`Error finding references: ${error}`);
      return undefined;
    }
  }
}