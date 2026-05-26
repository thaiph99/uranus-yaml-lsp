import { TemplateSearchResult } from "../types";
import { ArgoYamlNavigationTarget } from "./argoYamlNavigationService";
import { TemplateSearchService } from "./templateSearchService";

export type DefinitionNavigationTarget = Extract<
  ArgoYamlNavigationTarget,
  {
    readonly kind:
      | "templateDefinition"
      | "localTemplateDefinition"
      | "dagTaskDefinition"
      | "workflowTemplateDefinition";
  }
>;

export function isDefinitionNavigationTarget(
  target: ArgoYamlNavigationTarget
): target is DefinitionNavigationTarget {
  return target.kind.endsWith("Definition");
}

export function searchTargetDefinition(
  service: TemplateSearchService,
  rootPath: string,
  target: DefinitionNavigationTarget
): Promise<TemplateSearchResult> {
  switch (target.kind) {
    case "templateDefinition":
      return service.findTemplateInWorkflowTemplate(
        rootPath,
        target.workflowTemplateName,
        target.templateName,
        target.clusterScope ?? false
      );
    case "localTemplateDefinition":
      return service.findTemplateInArgoResource(rootPath, target.resourceName, target.templateName);
    case "dagTaskDefinition":
      return service.findDagTaskDefinition(rootPath, target.resourceName, target.templateName, target.taskName);
    case "workflowTemplateDefinition":
      return service.findTemplateDefinition(rootPath, target.workflowTemplateName, target.clusterScope ?? false);
  }
}

export function searchTargetReferences(
  service: TemplateSearchService,
  rootPath: string,
  target: ArgoYamlNavigationTarget,
  sourceFilePath?: string
): Promise<TemplateSearchResult> {
  switch (target.kind) {
    case "templateDefinition":
    case "templateReferences":
      return service.findTemplateReferences(
        rootPath,
        target.workflowTemplateName,
        target.templateName,
        target.clusterScope ?? false
      );
    case "localTemplateDefinition":
    case "localTemplateReferences":
      return service.findLocalTemplateReferences(
        rootPath,
        target.resourceName,
        target.templateName,
        sourceFilePath
      );
    case "dagTaskDefinition":
    case "dagTaskReferences":
      return service.findDagTaskReferences(rootPath, target.resourceName, target.templateName, target.taskName);
    case "workflowTemplateDefinition":
    case "workflowTemplateReferences":
      return service.findWorkflowTemplateReferences(rootPath, target.workflowTemplateName, target.clusterScope ?? false);
  }
}
