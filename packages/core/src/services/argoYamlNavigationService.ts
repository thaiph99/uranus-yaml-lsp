import {
  isReusableTemplateKind
} from "./argoYamlSyntax";
import type {
  DocumentPosition,
  TextDocumentReader
} from "./argoYamlDocumentContext";
import {
  isNavigationCandidateLine
} from "./argoYamlCursorSyntax";
import {
  getDagDependencyReferenceContext,
  getDagTaskDefinitionContext,
  getLocalTemplateCallContext,
  getTemplateDefinitionContext,
  getTemplateRefContext,
  getWorkflowTemplateDefinitionName,
  getWorkflowTemplateRefName
} from "./argoYamlTargetContext";

export type { DocumentPosition, TextDocumentReader } from "./argoYamlDocumentContext";

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
    document: TextDocumentReader,
    position: DocumentPosition
  ): ArgoYamlNavigationTarget | undefined {
    const line = document.getLine(position.line);
    if (!isNavigationCandidateLine(line)) {
      return undefined;
    }

    const dagDependencyReference = getDagDependencyReferenceContext(document, position);
    if (dagDependencyReference) {
      return {
        kind: "dagTaskDefinition",
        resourceName: dagDependencyReference.resourceName,
        templateName: dagDependencyReference.templateName,
        taskName: dagDependencyReference.taskName
      };
    }

    const dagTaskDefinition = getDagTaskDefinitionContext(document, position);
    if (dagTaskDefinition) {
      return {
        kind: "dagTaskReferences",
        resourceName: dagTaskDefinition.resourceName,
        templateName: dagTaskDefinition.templateName,
        taskName: dagTaskDefinition.taskName
      };
    }

    const templateDefinition = getTemplateDefinitionContext(document, position);
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

    const workflowTemplateDefinition = getWorkflowTemplateDefinitionName(document, position);
    if (workflowTemplateDefinition) {
      return {
        kind: "workflowTemplateReferences",
        workflowTemplateName: workflowTemplateDefinition.workflowTemplateName,
        ...(workflowTemplateDefinition.clusterScope ? { clusterScope: true } : {})
      };
    }

    const templateRefContext = getTemplateRefContext(document, position);
    if (templateRefContext) {
      return {
        kind: "templateDefinition",
        workflowTemplateName: templateRefContext.workflowTemplateName,
        templateName: templateRefContext.templateName,
        ...(templateRefContext.clusterScope ? { clusterScope: true } : {})
      };
    }

    const workflowTemplateRef = getWorkflowTemplateRefName(document, position);
    if (workflowTemplateRef) {
      return {
        kind: "workflowTemplateDefinition",
        workflowTemplateName: workflowTemplateRef.workflowTemplateName,
        ...(workflowTemplateRef.clusterScope ? { clusterScope: true } : {})
      };
    }

    const localTemplateCall = getLocalTemplateCallContext(document, position);
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
