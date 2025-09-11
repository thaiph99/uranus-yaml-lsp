import * as vscode from "vscode";
import { ArgoTemplateDefinitionProvider } from "./providers/argoTemplateDefinitionProvider";
import { TemplateSearchService, FileSystemService, WorkspaceCacheService } from "@uranus-yaml/core";

export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  // Initialize services with dependency injection
  const workspaceCacheService = new WorkspaceCacheService();
  const fileSystemService = new FileSystemService();
  const templateSearchService = new TemplateSearchService(fileSystemService);
  const definitionProvider = new ArgoTemplateDefinitionProvider(
    templateSearchService
  );

  // Register the definition provider for YAML files
  const definitionProviderDisposable = vscode.languages.registerDefinitionProvider(
    { language: "yaml" },
    definitionProvider
  );

  // Register disposables
  context.subscriptions.push(
    definitionProviderDisposable,
    workspaceCacheService
  );

  await vscode.window.showInformationMessage(
    "Uranus YAML extension activated."
  );
}

export function deactivate(): void {
  // Cleanup is handled by VS Code through subscriptions
}