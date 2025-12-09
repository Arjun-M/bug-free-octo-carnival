/**
 * @fileoverview Module cache with hit/miss tracking
 */

/**
 * Cache statistics
 */
export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
}

/**
 * Module cache for caching loaded modules
 */
export class ModuleCache {
  private cache: Map<string, any> = new Map();
  private hits: number = 0;
  private misses: number = 0;

  /**
   * Get a module from cache
   * @param moduleName Module identifier
   * @returns Cached module or undefined
   */
  get(moduleName: string): any | undefined {
    const module = this.cache.get(moduleName);
    if (module !== undefined) {
      this.hits++;
    } else {
      this.misses++;
    }
    return module;
  }

  /**
   * Set a module in cache
   * @param moduleName Module identifier
   * @param module Module to cache
   */
  set(moduleName: string, module: any): void {
    this.cache.set(moduleName, module);
  }

  /**
   * Check if module is cached
   * @param moduleName Module identifier
   * @returns True if cached
   */
  has(moduleName: string): boolean {
    return this.cache.has(moduleName);
  }

  /**
   * Delete a module from cache
   * @param moduleName Module identifier
   */
  delete(moduleName: string): void {
    this.cache.delete(moduleName);
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   * @returns Cache stats object
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? (this.hits / total) * 100 : 0,
    };
  }

  /**
   * Get all cached module names
   * @returns Array of module names
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
}
