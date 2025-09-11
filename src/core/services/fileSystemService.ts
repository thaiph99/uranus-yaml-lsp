import * as fs from 'fs';
import * as path from 'path';

/**
 * Service for file system operations, specifically for finding and reading YAML files.
 * Optimized with parallel directory traversal and file operations.
 */
export class FileSystemService {
  private readonly yamlExtensions = ['.yaml', '.yml'];
  private readonly maxConcurrency = 20; // Limit concurrent directory operations
  private readonly ignoredDirs = new Set([
    'node_modules', '.git', '.vscode', 'dist', 'build', 'out', 'target'
  ]);

  public async findYamlFiles(rootPath: string): Promise<string[]> {
    const allFiles = new Set<string>();
    await this.walkDirectoryParallel(rootPath, allFiles);
    return Array.from(allFiles);
  }

  public async readFileContent(filePath: string): Promise<string> {
    return fs.promises.readFile(filePath, 'utf8');
  }

  private async walkDirectoryParallel(
    dir: string,
    fileList: Set<string>,
    depth: number = 0
  ): Promise<void> {
    // Limit recursion depth to prevent infinite loops and improve performance
    if (depth > 10) return;

    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      const dirPromises: Promise<void>[] = [];

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isFile() && this.isYamlFile(entry.name)) {
          fileList.add(fullPath);
        } else if (entry.isDirectory() && !this.shouldIgnoreDirectory(entry.name)) {
          dirPromises.push(this.walkDirectoryParallel(fullPath, fileList, depth + 1));
        }
      }

      // Process directories in parallel with concurrency limit
      await this.processInBatches(dirPromises, this.maxConcurrency);

    } catch {
      // Silently skip inaccessible directories
    }
  }

  private async processInBatches<T>(
    promises: Promise<T>[],
    batchSize: number
  ): Promise<T[]> {
    const results: T[] = [];

    for (let i = 0; i < promises.length; i += batchSize) {
      const batch = promises.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(batch);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      }
    }

    return results;
  }

  private shouldIgnoreDirectory(dirName: string): boolean {
    return this.ignoredDirs.has(dirName) || dirName.startsWith('.');
  }

  private isYamlFile(fileName: string): boolean {
    return this.yamlExtensions.some(ext => fileName.endsWith(ext));
  }
}
