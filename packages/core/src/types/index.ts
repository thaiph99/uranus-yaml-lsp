export interface WorkflowTemplateLocation {
  readonly file: string;
  readonly line: number;
  readonly character: number;
  readonly endCharacter: number;
}

export interface TemplateSearchResult {
  readonly templateName: string;
  readonly locations: readonly WorkflowTemplateLocation[];
}

export interface TemplateRefContext {
  readonly workflowTemplateName: string;
  readonly templateName: string;
}
