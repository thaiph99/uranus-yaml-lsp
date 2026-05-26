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
import { WorkspaceCacheService } from "./workspaceCacheService";

type ContentSearch = (content: string, filePath: string) => WorkflowTemplateLocation[];

export class TemplateSearchService {
  private readonly maxConcurrency = 10;

  constructor(
    private readonly fileSystemService: FileSystemService,
    private readonly workspaceCacheService = new WorkspaceCacheService()
  ) {}

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
    const cached = this.workspaceCacheService.get(filePath);
    if (cached !== undefined) {
      return cached;
    }

    const content = await this.fileSystemService.readFileContent(filePath);
    this.workspaceCacheService.set(filePath, content);

    return content;
  }
}
