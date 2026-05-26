import { WorkflowTemplateLocation, TemplateSearchResult } from "../types";
import {
  findDagTaskDefinition,
  findDagTaskReferences,
  findLocalTemplateReferences,
  findReusableTemplateDefinitions,
  findReusableTemplateReferences,
  findReusableTemplateResourceReferences,
  findTemplateDefinitionInResource
} from "./argoYamlLocationSearch";
import { getReusableTemplateKind } from "./argoYamlSyntax";
import { FileSystemService } from "./fileSystemService";

interface CachedFileContent {
  content: string;
  timestamp: number;
}

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
      findReusableTemplateDefinitions(content, filePath, templateName, clusterScope)
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
      findTemplateDefinitionInResource(
        content,
        filePath,
        workflowTemplateName,
        templateName,
        getReusableTemplateKind(clusterScope)
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
      findTemplateDefinitionInResource(content, filePath, resourceName, templateName)
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
      findReusableTemplateReferences(
        content,
        filePath,
        workflowTemplateName,
        templateName,
        clusterScope
      )
    );
    const localLocations = await this.searchFiles(yamlFiles, (content, filePath) =>
      findLocalTemplateReferences(
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
      findLocalTemplateReferences(content, filePath, resourceName, templateName)
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
      findDagTaskDefinition(content, filePath, resourceName, templateName, taskName)
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
      findDagTaskReferences(content, filePath, resourceName, templateName, taskName)
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
      findReusableTemplateResourceReferences(content, filePath, workflowTemplateName, clusterScope)
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
}
