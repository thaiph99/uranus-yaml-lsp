export type ArgoResourceKind = "Workflow" | "CronWorkflow" | "WorkflowTemplate" | "ClusterWorkflowTemplate";
export type ReusableTemplateKind = "WorkflowTemplate" | "ClusterWorkflowTemplate";
export type NavigationKey = "name" | "generateName" | "template" | "entrypoint" | "onExit";

const argoResourceKindPattern = /^kind:\s*(Workflow|CronWorkflow|WorkflowTemplate|ClusterWorkflowTemplate)\s*(?:#.*)?$/;

export function getIndent(line: string): number {
  return line.match(/^\s*/)?.[0].length ?? 0;
}

// Only top-level `kind:` lines start a resource; indented ones belong to
// embedded manifests (e.g. `manifest: |` block scalars).
export function getArgoResourceKind(line: string): ArgoResourceKind | undefined {
  return line.match(argoResourceKindPattern)?.[1] as ArgoResourceKind | undefined;
}

export function isArgoResourceLine(line: string): boolean {
  return getArgoResourceKind(line) !== undefined;
}

export function isReusableTemplateKind(kind: ArgoResourceKind): kind is ReusableTemplateKind {
  return kind === "WorkflowTemplate" || kind === "ClusterWorkflowTemplate";
}

export function getReusableTemplateKind(clusterScope: boolean): ReusableTemplateKind {
  return clusterScope ? "ClusterWorkflowTemplate" : "WorkflowTemplate";
}

export function extractKeyValue(line: string, key: NavigationKey): string | undefined {
  const match = line.match(new RegExp(`${key}:\\s*['"]?([^'"#\\s]+)['"]?\\s*(?:#.*)?$`));
  return match?.[1];
}

export function extractNavigationValue(line: string): string | undefined {
  return line.match(/(?:name|generateName|template|entrypoint|onExit):\s*['"]?([^'"#\s]+)['"]?\s*(?:#.*)?$/)?.[1];
}
