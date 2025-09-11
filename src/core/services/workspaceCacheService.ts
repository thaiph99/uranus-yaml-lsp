import { WorkflowTemplateLocation } from '../types/index';

interface WorkspaceCache {
  templates: Map<string, WorkflowTemplateLocation[]>;
  lastScanned: number;
  fileHashes: Map<string, string>;
}

/**
 * Workspace-level caching service for template definitions.
 * Provides intelligent caching and invalidation based on file changes.
 */
export class WorkspaceCacheService {
  private cache: WorkspaceCache | null = null;
  private readonly cacheTimeout = 300000; // 5 minutes

  public getCachedTemplates(): Map<string, WorkflowTemplateLocation[]> | null {
    if (!this.cache || this.isCacheExpired()) {
      return null;
    }
    return this.cache.templates;
  }

  public setCachedTemplates(templates: Map<string, WorkflowTemplateLocation[]>): void {
    this.cache = {
      templates,
      lastScanned: Date.now(),
      fileHashes: new Map()
    };
  }

  public invalidateCache(): void {
    this.cache = null;
  }

  private isCacheExpired(): boolean {
    if (!this.cache) return true;
    return (Date.now() - this.cache.lastScanned) > this.cacheTimeout;
  }
}