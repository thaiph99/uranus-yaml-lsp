import { WorkflowTemplateLocation, TemplateSearchResult } from "../types";
import { FileSystemService } from "./fileSystemService";

interface CachedFileContent {
  content: string;
  timestamp: number;
}

type ReusableTemplateKind = "WorkflowTemplate" | "ClusterWorkflowTemplate";
type ContentSearch = (content: string, filePath: string) => WorkflowTemplateLocation[];

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
        this.getReusableTemplateKind(clusterScope)
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

    const resourceLines: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (this.isReusableTemplateLine(lines[i], clusterScope)) {
        resourceLines.push(i);
      }
    }

    for (const startIndex of resourceLines) {
      const nameLineIndex = this.findTemplateNameLine(
        lines,
        startIndex,
        templateName
      );
      if (nameLineIndex !== -1) {
        locations.push({
          file: filePath,
          line: nameLineIndex,
          ...this.getNameValueRange(lines[nameLineIndex], templateName),
        });
      }
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
    const locations: WorkflowTemplateLocation[] = [];

    const resourceStart = this.findReusableTemplateByName(lines, workflowTemplateName, clusterScope);
    if (resourceStart === -1) {
      return locations;
    }

    const resourceEnd = this.findResourceEnd(lines, resourceStart);

    const templatesSection = this.findTemplatesSection(lines, resourceStart, resourceEnd);
    if (templatesSection === -1) {
      return locations;
    }

    const templateLocation = this.findTemplateInTemplatesSection(
      lines,
      templatesSection,
      resourceEnd,
      templateName
    );

    if (templateLocation !== -1) {
      locations.push({
        file: filePath,
        line: templateLocation,
        ...this.getNameValueRange(lines[templateLocation], templateName),
      });
    }

    return locations;
  }

  private searchTemplateInArgoResourceContent(
    content: string,
    filePath: string,
    resourceName: string,
    templateName: string
  ): WorkflowTemplateLocation[] {
    const lines = content.split("\n");
    const locations: WorkflowTemplateLocation[] = [];

    const resourceStart = this.findArgoResourceByName(lines, resourceName);
    if (resourceStart === -1) {
      return locations;
    }

    const resourceEnd = this.findResourceEnd(lines, resourceStart);
    const templatesSection = this.findTemplatesSection(lines, resourceStart, resourceEnd);
    if (templatesSection === -1) {
      return locations;
    }

    const templateLocation = this.findTemplateInTemplatesSection(
      lines,
      templatesSection,
      resourceEnd,
      templateName
    );

    if (templateLocation !== -1) {
      locations.push({
        file: filePath,
        line: templateLocation,
        ...this.getNameValueRange(lines[templateLocation], templateName),
      });
    }

    return locations;
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
        const refBlock = this.parseTemplateRefBlock(lines, i);

        if (refBlock.workflowTemplateName === workflowTemplateName &&
            refBlock.templateName === templateName &&
            refBlock.clusterScope === clusterScope) {
          if (refBlock.templateLine !== -1) {
            locations.push({
              file: filePath,
              line: refBlock.templateLine,
              character: refBlock.templateCharacter,
              endCharacter: refBlock.templateEndCharacter,
            });
          }
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
        const refBlock = this.parseTemplateRefBlock(lines, i);

        if (refBlock.workflowTemplateName === workflowTemplateName &&
            refBlock.clusterScope === clusterScope) {
          const nameLineIndex = this.findWorkflowTemplateNameLineInTemplateRef(lines, i);
          if (nameLineIndex !== -1) {
            locations.push({
              file: filePath,
              line: nameLineIndex,
              ...this.getNameValueRange(lines[nameLineIndex], workflowTemplateName),
            });
          }
        }
      }

      if (line.includes("workflowTemplateRef:")) {
        const refBlock = this.parseWorkflowTemplateRefBlock(lines, i);
        if (refBlock.workflowTemplateName === workflowTemplateName &&
            refBlock.clusterScope === clusterScope &&
            refBlock.nameLine !== -1) {
          locations.push({
            file: filePath,
            line: refBlock.nameLine,
            ...this.getNameValueRange(lines[refBlock.nameLine], workflowTemplateName),
          });
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

    const resourceStart = this.findArgoResourceByName(lines, resourceName, resourceKind);
    if (resourceStart === -1) {
      return locations;
    }

    const resourceEnd = this.findResourceEnd(lines, resourceStart);

    for (let i = resourceStart; i < resourceEnd; i++) {
      const line = lines[i];
      const key = this.getLocalTemplateCallKey(lines, i);
      if (!key) {
        continue;
      }

      const value = this.extractKeyValue(line, key);
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
    const dagTasksSection = this.findScopedDagTasksSection(lines, resourceName, templateName);

    if (!dagTasksSection) {
      return locations;
    }

    for (let i = dagTasksSection.tasksStart + 1; i < dagTasksSection.tasksEnd; i++) {
      const line = lines[i];
      if (this.getIndent(line) !== dagTasksSection.taskIndent) {
        continue;
      }

      if (!/^\s*-\s+name:\s*/.test(line) || !this.isTemplateName(line, taskName)) {
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
    const dagTasksSection = this.findScopedDagTasksSection(lines, resourceName, templateName);

    if (!dagTasksSection) {
      return locations;
    }

    for (let i = dagTasksSection.tasksStart + 1; i < dagTasksSection.tasksEnd; i++) {
      const line = lines[i];
      const dependencyRanges = this.findDagDependencyReferenceRanges(
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

      if (/^\s*dependencies:\s*$/.test(line)) {
        i = this.skipMultilineDependencies(lines, i, dagTasksSection.tasksEnd);
      }
    }

    return locations;
  }

  private findWorkflowTemplateNameLineInTemplateRef(
    lines: string[],
    startIndex: number
  ): number {
    const blockIndent = this.getIndent(lines[startIndex]);
    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim() === "" || /^\s*#/.test(line)) {
        continue;
      }
      if (this.getIndent(line) <= blockIndent) {
        break;
      }

      if (/^\s*name:\s*/.test(line)) {
        return i;
      }
    }
    return -1;
  }

  private parseTemplateRefBlock(
    lines: string[],
    startIndex: number
  ): {
    workflowTemplateName: string | null;
    templateName: string | null;
    templateLine: number;
    templateCharacter: number;
    templateEndCharacter: number;
    clusterScope: boolean;
  } {
    let workflowTemplateName: string | null = null;
    let templateName: string | null = null;
    let templateLine = -1;
    let templateCharacter = 0;
    let templateEndCharacter = 0;
    let clusterScope = false;
    const blockIndent = this.getIndent(lines[startIndex]);

    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim() === "" || /^\s*#/.test(line)) {
        continue;
      }
      if (this.getIndent(line) <= blockIndent) {
        break;
      }

      if (/^\s*name:\s*/.test(line) && workflowTemplateName === null) {
        const nameMatch = line.match(/name:\s*['"]?([^'"#\s]+)['"]?\s*(?:#.*)?$/);
        if (nameMatch) {
          workflowTemplateName = nameMatch[1];
        }
      }

      if (/^\s*template:\s*/.test(line)) {
        const templateMatch = line.match(/template:\s*['"]?([^'"#\s]+)['"]?\s*(?:#.*)?$/);
        if (templateMatch) {
          templateName = templateMatch[1];
          templateLine = i;
          const templateRange = this.getTemplateValueRange(line, templateName);
          templateCharacter = templateRange.character;
          templateEndCharacter = templateRange.endCharacter;
        }
      }

      if (/^\s*clusterScope:\s*true\s*(?:#.*)?$/.test(line)) {
        clusterScope = true;
      }
    }

    return {
      workflowTemplateName,
      templateName,
      templateLine,
      templateCharacter,
      templateEndCharacter,
      clusterScope
    };
  }

  private parseWorkflowTemplateRefBlock(
    lines: string[],
    startIndex: number
  ): { workflowTemplateName: string | null; nameLine: number; clusterScope: boolean } {
    const blockIndent = this.getIndent(lines[startIndex]);
    let workflowTemplateName: string | null = null;
    let nameLine = -1;
    let clusterScope = false;

    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === "" || /^\s*#/.test(line)) {
        continue;
      }
      if (this.getIndent(line) <= blockIndent) {
        break;
      }

      const nameMatch = line.match(/^\s*name:\s*['"]?([^'"#\s]+)['"]?\s*(?:#.*)?$/);
      if (nameMatch) {
        workflowTemplateName = nameMatch[1];
        nameLine = i;
      }
      if (/^\s*clusterScope:\s*true\s*(?:#.*)?$/.test(line)) {
        clusterScope = true;
      }
    }

    return { workflowTemplateName, nameLine, clusterScope };
  }

  private getNameValueRange(line: string, expectedValue: string): { character: number; endCharacter: number } {
    return this.getKeyValueRange(line, "name", expectedValue);
  }

  private getTemplateValueRange(line: string, expectedValue: string): { character: number; endCharacter: number } {
    return this.getKeyValueRange(line, "template", expectedValue);
  }

  private getKeyValueRange(
    line: string,
    key: "name" | "template" | "entrypoint" | "onExit",
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

  private getReusableTemplateKind(clusterScope: boolean): ReusableTemplateKind {
    return clusterScope ? "ClusterWorkflowTemplate" : "WorkflowTemplate";
  }

  private isReusableTemplateLine(line: string, clusterScope: boolean): boolean {
    return new RegExp(`^\\s*kind:\\s*${this.getReusableTemplateKind(clusterScope)}\\s*(?:#.*)?$`).test(line);
  }

  private findTemplateNameLine(
    lines: string[],
    startIndex: number,
    templateName: string
  ): number {
    const resourceEnd = this.findResourceEnd(lines, startIndex);
    for (let j = startIndex; j < resourceEnd; j++) {
      const line = lines[j];
      if (
        this.isMetadataSection(lines, j) &&
        this.isTemplateName(line, templateName)
      ) {
        return j;
      }
    }
    return -1;
  }

  private isMetadataSection(lines: string[], currentIndex: number): boolean {
    return currentIndex > 0 && lines[currentIndex - 1].includes("metadata:");
  }

  private isTemplateName(line: string, templateName: string): boolean {
    const nameMatch = line.match(/name:\s*['"]?([^'"#\s]+)['"]?\s*(?:#.*)?$/);
    if (!nameMatch) {
      return false;
    }

    const extractedName = nameMatch[1];
    return extractedName === templateName;
  }

  private findReusableTemplateByName(
    lines: string[],
    workflowTemplateName: string,
    clusterScope: boolean
  ): number {
    for (let i = 0; i < lines.length; i++) {
      if (this.isReusableTemplateLine(lines[i], clusterScope)) {
        for (let j = i; j < Math.min(lines.length, i + 20); j++) {
          const line = lines[j];
          if (this.isMetadataSection(lines, j) && this.isTemplateName(line, workflowTemplateName)) {
            return i;
          }
        }
      }
    }
    return -1;
  }

  private findArgoResourceByName(
    lines: string[],
    resourceName: string,
    resourceKind?: ReusableTemplateKind
  ): number {
    for (let i = 0; i < lines.length; i++) {
      if (resourceKind
        ? !new RegExp(`^\\s*kind:\\s*${resourceKind}\\s*(?:#.*)?$`).test(lines[i])
        : !this.isArgoResourceLine(lines[i])) {
        continue;
      }

      for (let j = i; j < Math.min(lines.length, i + 20); j++) {
        const line = lines[j];
        if (this.isMetadataSection(lines, j) && this.isResourceName(line, resourceName)) {
          return i;
        }
      }
    }

    return -1;
  }

  private findResourceEnd(lines: string[], startIndex: number): number {
    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith("kind:") || (line.startsWith("apiVersion:") && lines[i-1]?.trim() === "---")) {
        return i;
      }
    }
    return lines.length;
  }

  private findTemplatesSection(lines: string[], startIndex: number, endIndex: number): number {
    for (let i = startIndex; i < endIndex; i++) {
      const line = lines[i].trim();
      if (line === "templates:" || line.startsWith("templates:")) {
        return i;
      }
    }
    return -1;
  }

  private findTemplateInTemplatesSection(
    lines: string[],
    templatesStart: number,
    templatesEnd: number,
    templateName: string
  ): number {
    const templateDefinitionIndent = this.getIndent(lines[templatesStart]) + 2;

    for (let i = templatesStart + 1; i < templatesEnd; i++) {
      const line = lines[i];

      if (
        this.getIndent(line) === templateDefinitionIndent &&
        line.match(/^\s*-\s+name:\s*['"]?([^'"#\s]+)['"]?\s*(?:#.*)?$/)
      ) {
        const nameMatch = line.match(/name:\s*['"]?([^'"#\s]+)['"]?\s*(?:#.*)?$/);
        if (nameMatch && nameMatch[1] === templateName) {
          return i;
        }
      }
    }
    return -1;
  }

  private findScopedDagTasksSection(
    lines: string[],
    resourceName: string,
    templateName: string
  ): { tasksStart: number; tasksEnd: number; taskIndent: number } | undefined {
    const resourceStart = this.findArgoResourceByName(lines, resourceName);
    if (resourceStart === -1) {
      return undefined;
    }

    const resourceEnd = this.findResourceEnd(lines, resourceStart);
    const templatesSection = this.findTemplatesSection(lines, resourceStart, resourceEnd);
    if (templatesSection === -1) {
      return undefined;
    }

    const templateStart = this.findTemplateInTemplatesSection(
      lines,
      templatesSection,
      resourceEnd,
      templateName
    );
    if (templateStart === -1) {
      return undefined;
    }

    const templateEnd = this.findTemplateBlockEnd(lines, templateStart, resourceEnd);
    const dagStart = this.findChildKeyLine(lines, templateStart, templateEnd, "dag");
    if (dagStart === -1) {
      return undefined;
    }

    const tasksStart = this.findChildKeyLine(lines, dagStart, templateEnd, "tasks");
    if (tasksStart === -1) {
      return undefined;
    }

    const tasksIndent = this.getIndent(lines[tasksStart]);
    const tasksEnd = this.findIndentedBlockEnd(lines, tasksStart, templateEnd);

    return {
      tasksStart,
      tasksEnd,
      taskIndent: tasksIndent + 2,
    };
  }

  private findTemplateBlockEnd(lines: string[], templateStart: number, resourceEnd: number): number {
    const templateIndent = this.getIndent(lines[templateStart]);

    for (let i = templateStart + 1; i < resourceEnd; i++) {
      const line = lines[i];
      if (line.trim() === "") {
        continue;
      }

      if (this.getIndent(line) === templateIndent && /^\s*-\s+name:\s*/.test(line)) {
        return i;
      }
    }

    return resourceEnd;
  }

  private findChildKeyLine(
    lines: string[],
    parentStart: number,
    parentEnd: number,
    key: "dag" | "tasks"
  ): number {
    const parentIndent = this.getIndent(lines[parentStart]);

    for (let i = parentStart + 1; i < parentEnd; i++) {
      const line = lines[i];
      if (line.trim() === "") {
        continue;
      }

      const indent = this.getIndent(line);
      if (indent <= parentIndent) {
        return -1;
      }

      if (indent > parentIndent && new RegExp(`^\\s*${key}:\\s*(?:#.*)?$`).test(line)) {
        return i;
      }
    }

    return -1;
  }

  private findIndentedBlockEnd(lines: string[], blockStart: number, maxEnd: number): number {
    const blockIndent = this.getIndent(lines[blockStart]);

    for (let i = blockStart + 1; i < maxEnd; i++) {
      const line = lines[i];
      if (line.trim() === "") {
        continue;
      }

      if (this.getIndent(line) <= blockIndent) {
        return i;
      }
    }

    return maxEnd;
  }

  private findDagDependencyReferenceRanges(
    lines: string[],
    lineIndex: number,
    tasksEnd: number,
    taskName: string
  ): { line: number; character: number; endCharacter: number }[] {
    const line = lines[lineIndex];

    if (/^\s*dependencies:\s*\[/.test(line)) {
      return this.findInlineDependencyRanges(line, lineIndex, taskName);
    }

    if (/^\s*dependencies:\s*$/.test(line)) {
      return this.findMultilineDependencyRanges(lines, lineIndex, tasksEnd, taskName);
    }

    if (/^\s*depends:\s*/.test(line)) {
      return this.findDependsExpressionRanges(line, lineIndex, taskName);
    }

    return [];
  }

  private findInlineDependencyRanges(
    line: string,
    lineIndex: number,
    taskName: string
  ): { line: number; character: number; endCharacter: number }[] {
    const ranges: { line: number; character: number; endCharacter: number }[] = [];
    const listStart = line.indexOf("[");
    const listEnd = line.indexOf("]", listStart + 1);
    if (listStart === -1 || listEnd === -1) {
      return ranges;
    }

    const listContent = line.slice(listStart + 1, listEnd);
    const dependencyPattern = /['"]?([A-Za-z0-9_-]+)['"]?/g;
    let match: RegExpExecArray | null;

    while ((match = dependencyPattern.exec(listContent)) !== null) {
      if (match[1] !== taskName || match.index === undefined) {
        continue;
      }

      const character = listStart + 1 + match.index + match[0].indexOf(taskName);
      ranges.push({
        line: lineIndex,
        character,
        endCharacter: character + taskName.length,
      });
    }

    return ranges;
  }

  private findMultilineDependencyRanges(
    lines: string[],
    dependenciesLine: number,
    tasksEnd: number,
    taskName: string
  ): { line: number; character: number; endCharacter: number }[] {
    const ranges: { line: number; character: number; endCharacter: number }[] = [];
    const dependenciesIndent = this.getIndent(lines[dependenciesLine]);

    for (let i = dependenciesLine + 1; i < tasksEnd; i++) {
      const line = lines[i];
      if (line.trim() === "") {
        continue;
      }

      if (this.getIndent(line) <= dependenciesIndent) {
        break;
      }

      const itemMatch = line.match(/^\s*-\s*['"]?([^'"#\s\]]+)['"]?\s*(?:#.*)?$/);
      if (!itemMatch || itemMatch[1] !== taskName) {
        continue;
      }

      const character = line.indexOf(taskName);
      ranges.push({
        line: i,
        character,
        endCharacter: character + taskName.length,
      });
    }

    return ranges;
  }

  private findDependsExpressionRanges(
    line: string,
    lineIndex: number,
    taskName: string
  ): { line: number; character: number; endCharacter: number }[] {
    const ranges: { line: number; character: number; endCharacter: number }[] = [];
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) {
      return ranges;
    }

    const valueStart = colonIndex + 1;
    const value = line.slice(valueStart);
    let tokenStart = -1;
    let inSingleQuote = false;
    let inDoubleQuote = false;

    const pushToken = (tokenEnd: number): void => {
      if (tokenStart === -1) {
        return;
      }

      const token = value.slice(tokenStart, tokenEnd);
      const taskNamePrefix = token.split(".", 1)[0];
      if (taskNamePrefix === taskName) {
        const character = valueStart + tokenStart;
        ranges.push({
          line: lineIndex,
          character,
          endCharacter: character + taskName.length,
        });
      }

      tokenStart = -1;
    };

    for (let i = 0; i < value.length; i++) {
      const character = value[i];

      if (!inSingleQuote && !inDoubleQuote && character === "#") {
        pushToken(i);
        break;
      }

      if (character === "'" && !inDoubleQuote) {
        pushToken(i);
        inSingleQuote = !inSingleQuote;
        continue;
      }

      if (character === '"' && !inSingleQuote) {
        pushToken(i);
        inDoubleQuote = !inDoubleQuote;
        continue;
      }

      if (this.isDependsTokenCharacter(character)) {
        if (tokenStart === -1) {
          tokenStart = i;
        }
        continue;
      }

      pushToken(i);
    }

    pushToken(value.length);

    return ranges;
  }

  private isDependsTokenCharacter(character: string): boolean {
    return /[A-Za-z0-9_\.-]/.test(character);
  }

  private skipMultilineDependencies(lines: string[], dependenciesLine: number, tasksEnd: number): number {
    const dependenciesIndent = this.getIndent(lines[dependenciesLine]);

    for (let i = dependenciesLine + 1; i < tasksEnd; i++) {
      const line = lines[i];
      if (line.trim() === "") {
        continue;
      }

      if (this.getIndent(line) <= dependenciesIndent) {
        return i - 1;
      }
    }

    return tasksEnd - 1;
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
    const lineIndent = this.getIndent(lines[lineIndex]);
    const startIndex = Math.max(0, lineIndex - 10);

    for (let i = lineIndex - 1; i >= startIndex; i--) {
      const line = lines[i];
      const indent = this.getIndent(line);
      if (indent < lineIndent && line.includes("templateRef:")) {
        return true;
      }
      if (indent < lineIndent && /^\s*-?\s*name:\s*/.test(line)) {
        return false;
      }
    }

    return false;
  }

  private isArgoResourceLine(line: string): boolean {
    return /kind:\s*(Workflow|CronWorkflow|WorkflowTemplate|ClusterWorkflowTemplate)\s*(?:#.*)?$/.test(line);
  }

  private isResourceName(line: string, resourceName: string): boolean {
    const nameMatch = line.match(/(?:name|generateName):\s*['"]?([^'"#\s]+)['"]?\s*(?:#.*)?$/);
    return nameMatch?.[1] === resourceName;
  }

  private extractKeyValue(line: string, key: "template" | "entrypoint" | "onExit"): string | undefined {
    const match = line.match(new RegExp(`${key}:\\s*['"]?([^'"#\\s]+)['"]?\\s*(?:#.*)?$`));
    return match?.[1];
  }

  private getIndent(line: string): number {
    return line.match(/^\s*/)?.[0].length ?? 0;
  }
}
