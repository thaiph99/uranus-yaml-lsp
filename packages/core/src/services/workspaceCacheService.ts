export class WorkspaceCacheService {
  private readonly cache = new Map<string, { content: string; timestamp: number }>();
  private readonly cacheTimeout = 30000;

  public get(key: string): string | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    if (Date.now() - entry.timestamp > this.cacheTimeout) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.content;
  }

  public set(key: string, content: string): void {
    this.cache.set(key, {
      content,
      timestamp: Date.now()
    });

    if (this.cache.size > 100) {
      this.cleanup();
    }
  }

  public delete(key: string): void {
    this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
  }

  public dispose(): void {
    this.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }
}
