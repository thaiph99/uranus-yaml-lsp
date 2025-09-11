import { WorkflowTemplateLocation, TemplateSearchResult } from "../types";
import { FileSystemService } from "./fileSystemService";

interface CachedFileContent {
  content: string;
  timestamp: number;
}

export class TemplateSearchService {
  private readonly fileCache = new Map<string, CachedFileContent>();
  private readonly cacheTimeout = 30000; // 30 seconds
  private readonly maxConcurrency = 10;

  constructor(private readonly fileSystemService: FileSystemService) {}

  public async findTemplateDefinition(
    rootPath: string,
    templateName: string
  ): Promise<TemplateSearchResult> {
    const yamlFiles = await this.fileSystemService.findYamlFiles(rootPath);

    const locations = await this.searchInFilesParallel(yamlFiles, templateName);

    return {
      templateName,
      locations: locations.flat(),
    };
  }

  public async findTemplateInWorkflowTemplate(
    rootPath: string,
    workflowTemplateName: string,
    templateName: string
  ): Promise<TemplateSearchResult> {
    const yamlFiles = await this.fileSystemService.findYamlFiles(rootPath);

    const locations = await this.searchTemplateInWorkflowTemplateFiles(
      yamlFiles,
      workflowTemplateName,
      templateName
    );

    return {
      templateName,
      locations: locations.flat(),
    };
  }

  public async findTemplateReferences(
    rootPath: string,
    workflowTemplateName: string,
    templateName: string
  ): Promise<TemplateSearchResult> {
    const yamlFiles = await this.fileSystemService.findYamlFiles(rootPath);

    const locations = await this.searchTemplateReferencesInFiles(
      yamlFiles,
      workflowTemplateName,
      templateName
    );

    const flatLocations = locations.flat();

    return {
      templateName,
      locations: flatLocations,
    };
  }

  public async findWorkflowTemplateReferences(
    rootPath: string,
    workflowTemplateName: string
  ): Promise<TemplateSearchResult> {
    const yamlFiles = await this.fileSystemService.findYamlFiles(rootPath);

    const locations = await this.searchWorkflowTemplateReferencesInFiles(
      yamlFiles,
      workflowTemplateName
    );

    const flatLocations = locations.flat();

    return {
      templateName: workflowTemplateName,
      locations: flatLocations,
    };
  }

  private async searchInFilesParallel(
    files: string[],
    templateName: string
  ): Promise<WorkflowTemplateLocation[][]> {
    const promises: Promise<WorkflowTemplateLocation[]>[] = [];

    for (let i = 0; i < files.length; i += this.maxConcurrency) {
      const batch = files.slice(i, i + this.maxConcurrency);
      const batchPromises = batch.map((file) =>
        this.searchInFile(file, templateName)
      );
      promises.push(...batchPromises);
    }

    return Promise.all(promises);
  }

  private async searchTemplateInWorkflowTemplateFiles(
    files: string[],
    workflowTemplateName: string,
    templateName: string
  ): Promise<WorkflowTemplateLocation[][]> {
    const promises: Promise<WorkflowTemplateLocation[]>[] = [];

    for (let i = 0; i < files.length; i += this.maxConcurrency) {
      const batch = files.slice(i, i + this.maxConcurrency);
      const batchPromises = batch.map((file) =>
        this.searchTemplateInWorkflowTemplateFile(file, workflowTemplateName, templateName)
      );
      promises.push(...batchPromises);
    }

    return Promise.all(promises);
  }

  private async searchTemplateReferencesInFiles(
    files: string[],
    workflowTemplateName: string,
    templateName: string
  ): Promise<WorkflowTemplateLocation[][]> {
    const promises: Promise<WorkflowTemplateLocation[]>[] = [];

    for (let i = 0; i < files.length; i += this.maxConcurrency) {
      const batch = files.slice(i, i + this.maxConcurrency);
      const batchPromises = batch.map((file) =>
        this.searchTemplateReferencesInFile(file, workflowTemplateName, templateName)
      );
      promises.push(...batchPromises);
    }

    return Promise.all(promises);
  }

  private async searchWorkflowTemplateReferencesInFiles(
    files: string[],
    workflowTemplateName: string
  ): Promise<WorkflowTemplateLocation[][]> {
    const promises: Promise<WorkflowTemplateLocation[]>[] = [];

    for (let i = 0; i < files.length; i += this.maxConcurrency) {
      const batch = files.slice(i, i + this.maxConcurrency);
      const batchPromises = batch.map((file) =>
        this.searchWorkflowTemplateReferencesInFile(file, workflowTemplateName)
      );
      promises.push(...batchPromises);
    }

    return Promise.all(promises);
  }

  private async searchInFile(
    filePath: string,
    templateName: string
  ): Promise<WorkflowTemplateLocation[]> {
    try {
      const content = await this.getCachedFileContent(filePath);
      return this.searchInContent(content, filePath, templateName);
    } catch {
      return [];
    }
  }

  private async searchTemplateInWorkflowTemplateFile(
    filePath: string,
    workflowTemplateName: string,
    templateName: string
  ): Promise<WorkflowTemplateLocation[]> {
    try {
      const content = await this.getCachedFileContent(filePath);
      return this.searchTemplateInWorkflowTemplateContent(
        content,
        filePath,
        workflowTemplateName,
        templateName
      );
    } catch {
      return [];
    }
  }

  private async searchTemplateReferencesInFile(
    filePath: string,
    workflowTemplateName: string,
    templateName: string
  ): Promise<WorkflowTemplateLocation[]> {
    try {
      const content = await this.getCachedFileContent(filePath);
      return this.searchTemplateReferencesInContent(
        content,
        filePath,
        workflowTemplateName,
        templateName
      );
    } catch {
      return [];
    }
  }

  private async searchWorkflowTemplateReferencesInFile(
    filePath: string,
    workflowTemplateName: string
  ): Promise<WorkflowTemplateLocation[]> {
    try {
      const content = await this.getCachedFileContent(filePath);
      return this.searchWorkflowTemplateReferencesInContent(
        content,
        filePath,
        workflowTemplateName
      );
    } catch {
      return [];
    }
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

  private searchInContent(
    content: string,
    filePath: string,
    templateName: string
  ): WorkflowTemplateLocation[] {
    const lines = content.split("\n");
    const locations: WorkflowTemplateLocation[] = [];

    const workflowTemplateLines: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (this.isWorkflowTemplateLine(lines[i])) {
        workflowTemplateLines.push(i);
      }
    }

    for (const startIndex of workflowTemplateLines) {
      const nameLineIndex = this.findTemplateNameLine(
        lines,
        startIndex,
        templateName
      );
      if (nameLineIndex !== -1) {
        locations.push({
          file: filePath,
          line: nameLineIndex,
        });
      }
    }

    return locations;
  }

  private searchTemplateInWorkflowTemplateContent(
    content: string,
    filePath: string,
    workflowTemplateName: string,
    templateName: string
  ): WorkflowTemplateLocation[] {
    const lines = content.split("\n");
    const locations: WorkflowTemplateLocation[] = [];

    const workflowTemplateStart = this.findWorkflowTemplateByName(lines, workflowTemplateName);
    if (workflowTemplateStart === -1) {
      return locations;
    }

    const workflowTemplateEnd = this.findWorkflowTemplateEnd(lines, workflowTemplateStart);

    const templatesSection = this.findTemplatesSection(lines, workflowTemplateStart, workflowTemplateEnd);
    if (templatesSection === -1) {
      return locations;
    }

    const templateLocation = this.findTemplateInTemplatesSection(
      lines,
      templatesSection,
      workflowTemplateEnd,
      templateName
    );

    if (templateLocation !== -1) {
      locations.push({
        file: filePath,
        line: templateLocation,
      });
    }

    return locations;
  }

  private searchTemplateReferencesInContent(
    content: string,
    filePath: string,
    workflowTemplateName: string,
    templateName: string
  ): WorkflowTemplateLocation[] {
    const lines = content.split("\n");
    const locations: WorkflowTemplateLocation[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.includes("templateRef:")) {
        const refBlock = this.parseTemplateRefBlock(lines, i);

        if (refBlock.workflowTemplateName === workflowTemplateName &&
            refBlock.templateName === templateName) {
          if (refBlock.templateLine !== -1) {
            locations.push({
              file: filePath,
              line: refBlock.templateLine,
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
    workflowTemplateName: string
  ): WorkflowTemplateLocation[] {
    const lines = content.split("\n");
    const locations: WorkflowTemplateLocation[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.includes("templateRef:")) {
        const refBlock = this.parseTemplateRefBlock(lines, i);

        if (refBlock.workflowTemplateName === workflowTemplateName) {
          const nameLineIndex = this.findWorkflowTemplateNameLineInTemplateRef(lines, i);
          if (nameLineIndex !== -1) {
            locations.push({
              file: filePath,
              line: nameLineIndex,
            });
          }
        }
      }

      if (line.includes("workflowTemplateRef:")) {
        for (let j = i + 1; j <= Math.min(lines.length - 1, i + 5); j++) {
          const nameCandidate = lines[j];
          if (nameCandidate.includes("name:")) {
            const nameMatch = nameCandidate.match(/name:\s*['"]?([^'"#\s]+)['"]?\s*(?:#.*)?$/);
            if (nameMatch && nameMatch[1] === workflowTemplateName) {
              locations.push({
                file: filePath,
                line: j,
              });
              break;
            }
          }
        }
      }
    }

    return locations;
  }

  private findWorkflowTemplateNameLineInTemplateRef(
    lines: string[],
    startIndex: number
  ): number {
    for (let i = startIndex; i < Math.min(lines.length, startIndex + 10); i++) {
      const line = lines[i];

      if (i > startIndex && (line.includes("- name:") || line.includes("- -"))) {
        break;
      }

      if (line.includes("name:") && !line.includes("template:")) {
        return i;
      }
    }
    return -1;
  }

  private parseTemplateRefBlock(
    lines: string[],
    startIndex: number
  ): { workflowTemplateName: string | null; templateName: string | null; templateLine: number } {
    let workflowTemplateName: string | null = null;
    let templateName: string | null = null;
    let templateLine = -1;

    for (let i = startIndex; i < Math.min(lines.length, startIndex + 10); i++) {
      const line = lines[i];

      if (i > startIndex && (line.includes("- name:") || line.includes("- -"))) {
        break;
      }

      if (line.includes("name:") && !line.includes("template:") && workflowTemplateName === null) {
        const nameMatch = line.match(/name:\s*['"]?([^'"#\s]+)['"]?\s*(?:#.*)?$/);
        if (nameMatch) {
          workflowTemplateName = nameMatch[1];
        }
      }

      if (line.includes("template:")) {
        const templateMatch = line.match(/template:\s*['"]?([^'"#\s]+)['"]?\s*(?:#.*)?$/);
        if (templateMatch) {
          templateName = templateMatch[1];
          templateLine = i;
        }
      }
    }

    return { workflowTemplateName, templateName, templateLine };
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

  private isWorkflowTemplateLine(line: string): boolean {
    return line.includes("kind: WorkflowTemplate");
  }

  private findTemplateNameLine(
    lines: string[],
    startIndex: number,
    templateName: string
  ): number {
    for (let j = startIndex; j < lines.length; j++) {
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

  private findWorkflowTemplateByName(lines: string[], workflowTemplateName: string): number {
    for (let i = 0; i < lines.length; i++) {
      if (this.isWorkflowTemplateLine(lines[i])) {
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

  private findWorkflowTemplateEnd(lines: string[], startIndex: number): number {
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
    for (let i = templatesStart + 1; i < templatesEnd; i++) {
      const line = lines[i];

      if (line.match(/^\s*-\s+name:\s*['"]?([^'"#\s]+)['"]?\s*(?:#.*)?$/)) {
        const nameMatch = line.match(/name:\s*['"]?([^'"#\s]+)['"]?\s*(?:#.*)?$/);
        if (nameMatch && nameMatch[1] === templateName) {
          return i;
        }
      }
    }
    return -1;
  }
}