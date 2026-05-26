import * as vscode from "vscode";
import { ArgoYamlDefinitionProvider } from "./providers/argoYamlDefinitionProvider";
import { TemplateSearchService, FileSystemService, WorkspaceCacheService } from "@uranus-yaml/core";

export function activate(context: vscode.ExtensionContext): void {
  const workspaceCacheService = new WorkspaceCacheService();
  const fileSystemService = new FileSystemService();
  const templateSearchService = new TemplateSearchService(fileSystemService, workspaceCacheService);
  const definitionProvider = new ArgoYamlDefinitionProvider(
    templateSearchService
  );

  const definitionProviderDisposable = vscode.languages.registerDefinitionProvider(
    { language: "yaml" },
    definitionProvider
  );
  const referencesProviderDisposable = vscode.languages.registerReferenceProvider(
    { language: "yaml" },
    definitionProvider
  );

  context.subscriptions.push(
    definitionProviderDisposable,
    referencesProviderDisposable,
    workspaceCacheService
  );
}
