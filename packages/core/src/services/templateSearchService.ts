import { WorkflowTemplateLocation, TemplateSearchResult } from "../types";
import {
  extractKeyValue,
  getIndent,
  getReusableTemplateKind,
  NavigationKey,
  ReusableTemplateKind
} from "./argoYamlSyntax";
import {
  findArgoResourceByName,
  findResourceEnd,
  findReusableTemplateDefinitionLines,
  findScopedDagTasksSection,
  findTemplateInTemplatesSection,
  findTemplatesSection
} from "./argoYamlStructure";
import {
  findDagDependencyRanges,
  findMultilineDependenciesEnd,
  isMultilineDependenciesLine
} from "./dagDependencySyntax";
import { FileSystemService } from "./fileSystemService";

interface CachedFileContent {
  content: string;
  timestamp: number;
}

type ContentSearch = (content: string, filePath: string) => WorkflowTemplateLocation[];

interface ValueLocation {
  readonly value: string;
  readonly line: number;
  readonly character: number;
  readonly endCharacter: number;
}

interface ReusableTemplateReference {
  readonly name: ValueLocation | undefined;
  readonly template: ValueLocation | undefined;
  readonly clusterScope: boolean;
}

export class TemplateSearchService {
  private readonly fileCache = new Map<string, CachedFileContent>();
  private readonly cacheTimeout = 30000; // 30 seconds
  private readonly maxConcurrency = 10;

  constructor(private readonly fileSystemService: FileSystemService) {}

  public async findTemplateDefinition(
    rootPath: string,
    templateName: string,
    clusterScope = false
  ): Promise<TemplateSearchResult> {
    const yamlFiles = await this.fileSystemService.findYamlFiles(rootPath);
    const locations = await this.searchFiles(yamlFiles, (content, filePath) =>
      this.searchReusableTemplateDefinitionInContent(content, filePath, templateName, clusterScope)
    );

    return {
      templateName,
      locations,
    };
  }

  public async findTemplateInWorkflowTemplate(
    rootPath: string,
    workflowTemplateName: string,
    templateName: string,
    clusterScope = false
  ): Promise<TemplateSearchResult> {
    const yamlFiles = await this.fileSystemService.findYamlFiles(rootPath);
    const locations = await this.searchFiles(yamlFiles, (content, filePath) =>
      this.searchTemplateInWorkflowTemplateContent(
        content,
        filePath,
        workflowTemplateName,
        templateName,
        clusterScope
      )
    );

    return {
      templateName,
      locations,
    };
  }

  public async findTemplateInArgoResource(
    rootPath: string,
    resourceName: string,
    templateName: string
  ): Promise<TemplateSearchResult> {
    const yamlFiles = await this.fileSystemService.findYamlFiles(rootPath);
    const locations = await this.searchFiles(yamlFiles, (content, filePath) =>
      this.searchTemplateInArgoResourceContent(content, filePath, resourceName, templateName)
    );

    return {
      templateName,
      locations,
    };
  }

  public async findTemplateReferences(
    rootPath: string,
    workflowTemplateName: string,
    templateName: string,
    clusterScope = false
  ): Promise<TemplateSearchResult> {
    const yamlFiles = await this.fileSystemService.findYamlFiles(rootPath);
    const locations = await this.searchFiles(yamlFiles, (content, filePath) =>
      this.searchTemplateReferencesInContent(
        content,
        filePath,
        workflowTemplateName,
        templateName,
        clusterScope
      )
    );
    const localLocations = await this.searchFiles(yamlFiles, (content, filePath) =>
      this.searchLocalTemplateReferencesInContent(
        content,
        filePath,
        workflowTemplateName,
        templateName,
        getReusableTemplateKind(clusterScope)
      )
    );

    return {
      templateName,
      locations: locations.concat(localLocations),
    };
  }

  public async findLocalTemplateReferences(
    rootPath: string,
    resourceName: string,
    templateName: string
  ): Promise<TemplateSearchResult> {
    const yamlFiles = await this.fileSystemService.findYamlFiles(rootPath);
    const locations = await this.searchFiles(yamlFiles, (content, filePath) =>
      this.searchLocalTemplateReferencesInContent(content, filePath, resourceName, templateName)
    );

    return {
      templateName,
      locations,
    };
  }

  public async findDagTaskDefinition(
    rootPath: string,
    resourceName: string,
    templateName: string,
    taskName: string
  ): Promise<TemplateSearchResult> {
    const yamlFiles = await this.fileSystemService.findYamlFiles(rootPath);
    const locations = await this.searchFiles(yamlFiles, (content, filePath) =>
      this.searchDagTaskDefinitionInContent(content, filePath, resourceName, templateName, taskName)
    );

    return {
      templateName: taskName,
      locations,
    };
  }

  public async findDagTaskReferences(
    rootPath: string,
    resourceName: string,
    templateName: string,
    taskName: string
  ): Promise<TemplateSearchResult> {
    const yamlFiles = await this.fileSystemService.findYamlFiles(rootPath);
    const locations = await this.searchFiles(yamlFiles, (content, filePath) =>
      this.searchDagTaskReferencesInContent(content, filePath, resourceName, templateName, taskName)
    );

    return {
      templateName: taskName,
      locations,
    };
  }

  public async findWorkflowTemplateReferences(
    rootPath: string,
    workflowTemplateName: string,
    clusterScope = false
  ): Promise<TemplateSearchResult> {
    const yamlFiles = await this.fileSystemService.findYamlFiles(rootPath);
    const locations = await this.searchFiles(yamlFiles, (content, filePath) =>
      this.searchWorkflowTemplateReferencesInContent(content, filePath, workflowTemplateName, clusterScope)
    );

    return {
      templateName: workflowTemplateName,
      locations,
    };
  }

  private async searchFiles(files: string[], search: ContentSearch): Promise<WorkflowTemplateLocation[]> {
    const locations: WorkflowTemplateLocation[] = [];

    for (let index = 0; index < files.length; index += this.maxConcurrency) {
      const batch = files.slice(index, index + this.maxConcurrency);
      const results = await Promise.all(batch.map(async (filePath) => {
        try {
          return search(await this.getCachedFileContent(filePath), filePath);
        } catch {
          return [];
        }
      }));

      locations.push(...results.flat());
    }

    return locations;
  }

  private async getCachedFileContent(filePath: string): Promise<string> {
    const cached = this.fileCache.get(filePath);
    const now = Date.now();

    if (cached && now - cached.timestamp < this.cacheTimeout) {
      return cached.content;
    }

    const content = await this.fileSystemService.readFileContent(filePath);
    this.fileCache.set(filePath, { content, timestamp: now });

    if (this.fileCache.size > 100) {
      this.cleanupCache();
    }

    return content;
  }

  private searchReusableTemplateDefinitionInContent(
    content: string,
    filePath: string,
    templateName: string,
    clusterScope: boolean
  ): WorkflowTemplateLocation[] {
    const lines = content.split("\n");
    const locations: WorkflowTemplateLocation[] = [];

    for (const line of findReusableTemplateDefinitionLines(lines, templateName, clusterScope)) {
      locations.push({
        file: filePath,
        line,
        ...this.getNameValueRange(lines[line], templateName),
      });
    }

    return locations;
  }

  private searchTemplateInWorkflowTemplateContent(
    content: string,
    filePath: string,
    workflowTemplateName: string,
    templateName: string,
    clusterScope: boolean
  ): WorkflowTemplateLocation[] {
    const lines = content.split("\n");
    const resourceStart = findArgoResourceByName(
      lines,
      workflowTemplateName,
      getReusableTemplateKind(clusterScope)
    );
    if (resourceStart === -1) {
      return [];
    }

    return this.locateTemplateDefinition(lines, filePath, resourceStart, templateName);
  }

  private searchTemplateInArgoResourceContent(
    content: string,
    filePath: string,
    resourceName: string,
    templateName: string
  ): WorkflowTemplateLocation[] {
    const lines = content.split("\n");
    const resourceStart = findArgoResourceByName(lines, resourceName);
    if (resourceStart === -1) {
      return [];
    }

    return this.locateTemplateDefinition(lines, filePath, resourceStart, templateName);
  }

  private locateTemplateDefinition(
    lines: string[],
    filePath: string,
    resourceStart: number,
    templateName: string
  ): WorkflowTemplateLocation[] {
    const resourceEnd = findResourceEnd(lines, resourceStart);
    const templatesSection = findTemplatesSection(lines, resourceStart, resourceEnd);
    if (templatesSection === -1) {
      return [];
    }

    const templateLocation = findTemplateInTemplatesSection(
      lines,
      templatesSection,
      resourceEnd,
      templateName
    );

    if (templateLocation === -1) {
      return [];
    }

    return [{
      file: filePath,
      line: templateLocation,
      ...this.getNameValueRange(lines[templateLocation], templateName),
    }];
  }

  private searchTemplateReferencesInContent(
    content: string,
    filePath: string,
    workflowTemplateName: string,
    templateName: string,
    clusterScope: boolean
  ): WorkflowTemplateLocation[] {
    const lines = content.split("\n");
    const locations: WorkflowTemplateLocation[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.includes("templateRef:")) {
        const ref = this.parseReusableTemplateReference(lines, i);

        if (ref.name?.value === workflowTemplateName &&
            ref.template?.value === templateName &&
            ref.clusterScope === clusterScope) {
          locations.push({ file: filePath, ...ref.template });
        }
      }
    }

    return locations;
  }

  private searchWorkflowTemplateReferencesInContent(
    content: string,
    filePath: string,
    workflowTemplateName: string,
    clusterScope: boolean
  ): WorkflowTemplateLocation[] {
    const lines = content.split("\n");
    const locations: WorkflowTemplateLocation[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.includes("templateRef:")) {
        const ref = this.parseReusableTemplateReference(lines, i);

        if (ref.name?.value === workflowTemplateName &&
            ref.clusterScope === clusterScope) {
          locations.push({ file: filePath, ...ref.name });
        }
      }

      if (line.includes("workflowTemplateRef:")) {
        const ref = this.parseReusableTemplateReference(lines, i);
        if (ref.name?.value === workflowTemplateName &&
            ref.clusterScope === clusterScope) {
          locations.push({ file: filePath, ...ref.name });
        }
      }
    }

    return locations;
  }

  private searchLocalTemplateReferencesInContent(
    content: string,
    filePath: string,
    resourceName: string,
    templateName: string,
    resourceKind?: ReusableTemplateKind
  ): WorkflowTemplateLocation[] {
    const lines = content.split("\n");
    const locations: WorkflowTemplateLocation[] = [];

    const resourceStart = findArgoResourceByName(lines, resourceName, resourceKind);
    if (resourceStart === -1) {
      return locations;
    }

    const resourceEnd = findResourceEnd(lines, resourceStart);

    for (let i = resourceStart; i < resourceEnd; i++) {
      const line = lines[i];
      const key = this.getLocalTemplateCallKey(lines, i);
      if (!key) {
        continue;
      }

      const value = extractKeyValue(line, key);
      if (value !== templateName) {
        continue;
      }

      locations.push({
        file: filePath,
        line: i,
        ...this.getKeyValueRange(line, key, templateName),
      });
    }

    return locations;
  }

  private searchDagTaskDefinitionInContent(
    content: string,
    filePath: string,
    resourceName: string,
    templateName: string,
    taskName: string
  ): WorkflowTemplateLocation[] {
    const lines = content.split("\n");
    const locations: WorkflowTemplateLocation[] = [];
    const dagTasksSection = findScopedDagTasksSection(lines, resourceName, templateName);

    if (!dagTasksSection) {
      return locations;
    }

    for (let i = dagTasksSection.tasksStart + 1; i < dagTasksSection.tasksEnd; i++) {
      const line = lines[i];
      if (getIndent(line) !== dagTasksSection.taskIndent) {
        continue;
      }

      if (!/^\s*-\s+name:\s*/.test(line) || extractKeyValue(line, "name") !== taskName) {
        continue;
      }

      locations.push({
        file: filePath,
        line: i,
        ...this.getNameValueRange(line, taskName),
      });
    }

    return locations;
  }

  private searchDagTaskReferencesInContent(
    content: string,
    filePath: string,
    resourceName: string,
    templateName: string,
    taskName: string
  ): WorkflowTemplateLocation[] {
    const lines = content.split("\n");
    const locations: WorkflowTemplateLocation[] = [];
    const dagTasksSection = findScopedDagTasksSection(lines, resourceName, templateName);

    if (!dagTasksSection) {
      return locations;
    }

    for (let i = dagTasksSection.tasksStart + 1; i < dagTasksSection.tasksEnd; i++) {
      const line = lines[i];
      const dependencyRanges = findDagDependencyRanges(
        lines,
        i,
        dagTasksSection.tasksEnd,
        taskName
      );

      for (const range of dependencyRanges) {
        locations.push({
          file: filePath,
          line: range.line,
          character: range.character,
          endCharacter: range.endCharacter,
        });
      }

      if (isMultilineDependenciesLine(line)) {
        i = findMultilineDependenciesEnd(lines, i, dagTasksSection.tasksEnd);
      }
    }

    return locations;
  }

  private parseReusableTemplateReference(
    lines: string[],
    startIndex: number
  ): ReusableTemplateReference {
    let name: ValueLocation | undefined;
    let template: ValueLocation | undefined;
    let clusterScope = false;
    const blockIndent = getIndent(lines[startIndex]);

    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim() === "" || /^\s*#/.test(line)) {
        continue;
      }
      if (getIndent(line) <= blockIndent) {
        break;
      }

      const nameValue = extractKeyValue(line, "name");
      if (nameValue && !name) {
        name = { value: nameValue, line: i, ...this.getKeyValueRange(line, "name", nameValue) };
      }

      const templateValue = extractKeyValue(line, "template");
      if (templateValue) {
        template = { value: templateValue, line: i, ...this.getKeyValueRange(line, "template", templateValue) };
      }

      if (/^\s*clusterScope:\s*true\s*(?:#.*)?$/.test(line)) {
        clusterScope = true;
      }
    }

    return { name, template, clusterScope };
  }

  private getNameValueRange(line: string, expectedValue: string): { character: number; endCharacter: number } {
    return this.getKeyValueRange(line, "name", expectedValue);
  }

  private getKeyValueRange(
    line: string,
    key: NavigationKey,
    expectedValue: string
  ): { character: number; endCharacter: number } {
    const match = line.match(new RegExp(`${key}:\\s*['"]?([^'"#\\s]+)['"]?\\s*(?:#.*)?$`));
    if (!match || match.index === undefined || match[1] !== expectedValue) {
      return { character: 0, endCharacter: line.length };
    }

    const colonIndex = match[0].indexOf(":");
    const characterInMatch = match[0].indexOf(expectedValue, colonIndex + 1);
    if (characterInMatch === -1) {
      return { character: 0, endCharacter: line.length };
    }

    const character = match.index + characterInMatch;
    return { character, endCharacter: character + expectedValue.length };
  }

  private cleanupCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, value] of this.fileCache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.fileCache.delete(key));
  }

  private getLocalTemplateCallKey(
    lines: string[],
    lineIndex: number
  ): "template" | "entrypoint" | "onExit" | undefined {
    const line = lines[lineIndex];
    if (/^\s*entrypoint:\s*/.test(line)) {
      return "entrypoint";
    }
    if (/^\s*onExit:\s*/.test(line)) {
      return "onExit";
    }
    if (/^\s*template:\s*/.test(line) && !this.isTemplateRefValueLine(lines, lineIndex)) {
      return "template";
    }

    return undefined;
  }

  private isTemplateRefValueLine(lines: string[], lineIndex: number): boolean {
    const lineIndent = getIndent(lines[lineIndex]);
    const startIndex = Math.max(0, lineIndex - 10);

    for (let i = lineIndex - 1; i >= startIndex; i--) {
      const line = lines[i];
      const indent = getIndent(line);
      if (indent < lineIndent && line.includes("templateRef:")) {
        return true;
      }
      if (indent < lineIndent && /^\s*-?\s*name:\s*/.test(line)) {
        return false;
      }
    }

    return false;
  }
}
