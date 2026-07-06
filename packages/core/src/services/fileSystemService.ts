import * as fs from 'fs';
import * as path from 'path';

export class FileSystemService {
  private readonly maxDepth = 10;
  private readonly ignoredDirs = new Set([
    'node_modules', '.git', '.vscode', 'dist', 'build', 'out', 'target'
  ]);

  public async findYamlFiles(rootPath: string): Promise<string[]> {
    const files: string[] = [];
    await this.walkDirectory(rootPath, files, 0);
    return files;
  }

  public readFileContent(filePath: string): Promise<string> {
    return fs.promises.readFile(filePath, 'utf8');
  }

  private async walkDirectory(dir: string, files: string[], depth: number): Promise<void> {
    if (depth > this.maxDepth) {
      return;
    }

    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return; // Silently skip inaccessible directories
    }

    const subdirectories: Promise<void>[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile() && this.isYamlFile(entry.name)) {
        files.push(fullPath);
      } else if (entry.isDirectory() && !this.shouldIgnoreDirectory(entry.name)) {
        subdirectories.push(this.walkDirectory(fullPath, files, depth + 1));
      }
    }

    await Promise.all(subdirectories);
  }

  private shouldIgnoreDirectory(dirName: string): boolean {
    return this.ignoredDirs.has(dirName) || dirName.startsWith('.');
  }

  private isYamlFile(fileName: string): boolean {
    return fileName.endsWith('.yaml') || fileName.endsWith('.yml');
  }
}
