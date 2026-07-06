import { isReusableTemplateKind } from "./argoYamlSyntax";
import type { DocumentPosition } from "./argoYamlDocumentContext";
import { isNavigationCandidateLine } from "./argoYamlCursorSyntax";
import {
  getDagDependencyReferenceContext,
  getDagTaskDefinitionContext,
  getLocalTemplateCallContext,
  getTemplateDefinitionContext,
  getTemplateRefContext,
  getWorkflowTemplateDefinitionName,
  getWorkflowTemplateRefName
} from "./argoYamlTargetContext";

export type { DocumentPosition } from "./argoYamlDocumentContext";

export type ArgoYamlNavigationTarget =
  | {
      readonly kind: "templateReferences";
      readonly workflowTemplateName: string;
      readonly templateName: string;
      readonly clusterScope?: true;
    }
  | {
      readonly kind: "workflowTemplateReferences";
      readonly workflowTemplateName: string;
      readonly clusterScope?: true;
    }
  | {
      readonly kind: "templateDefinition";
      readonly workflowTemplateName: string;
      readonly templateName: string;
      readonly clusterScope?: true;
    }
  | {
      readonly kind: "localTemplateDefinition";
      readonly resourceName: string;
      readonly templateName: string;
    }
  | {
      readonly kind: "localTemplateReferences";
      readonly resourceName: string;
      readonly templateName: string;
    }
  | {
      readonly kind: "dagTaskDefinition";
      readonly resourceName: string;
      readonly templateName: string;
      readonly taskName: string;
    }
  | {
      readonly kind: "dagTaskReferences";
      readonly resourceName: string;
      readonly templateName: string;
      readonly taskName: string;
    }
  | {
      readonly kind: "workflowTemplateDefinition";
      readonly workflowTemplateName: string;
      readonly clusterScope?: true;
    };

export class ArgoYamlNavigationService {
  public getNavigationTarget(
    lines: string[],
    position: DocumentPosition
  ): ArgoYamlNavigationTarget | undefined {
    const line = lines[position.line];
    if (!line || !isNavigationCandidateLine(line)) {
      return undefined;
    }

    const dagDependencyReference = getDagDependencyReferenceContext(lines, position);
    if (dagDependencyReference) {
      return { kind: "dagTaskDefinition", ...dagDependencyReference };
    }

    const dagTaskDefinition = getDagTaskDefinitionContext(lines, position);
    if (dagTaskDefinition) {
      return { kind: "dagTaskReferences", ...dagTaskDefinition };
    }

    const templateDefinition = getTemplateDefinitionContext(lines, position);
    if (templateDefinition) {
      if (isReusableTemplateKind(templateDefinition.resource.kind)) {
        return {
          kind: "templateReferences",
          workflowTemplateName: templateDefinition.resource.name,
          templateName: templateDefinition.templateName,
          ...(templateDefinition.resource.kind === "ClusterWorkflowTemplate" ? { clusterScope: true } : {})
        };
      }

      return {
        kind: "localTemplateReferences",
        resourceName: templateDefinition.resource.name,
        templateName: templateDefinition.templateName
      };
    }

    const workflowTemplateDefinition = getWorkflowTemplateDefinitionName(lines, position);
    if (workflowTemplateDefinition) {
      return { kind: "workflowTemplateReferences", ...workflowTemplateDefinition };
    }

    const templateRefContext = getTemplateRefContext(lines, position);
    if (templateRefContext) {
      return { kind: "templateDefinition", ...templateRefContext };
    }

    const workflowTemplateRef = getWorkflowTemplateRefName(lines, position);
    if (workflowTemplateRef) {
      return { kind: "workflowTemplateDefinition", ...workflowTemplateRef };
    }

    const localTemplateCall = getLocalTemplateCallContext(lines, position);
    if (localTemplateCall) {
      return {
        kind: "localTemplateDefinition",
        resourceName: localTemplateCall.resource.name,
        templateName: localTemplateCall.templateName
      };
    }

    return undefined;
  }
}
