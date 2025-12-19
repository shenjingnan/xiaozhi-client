/**
 * 扣子 API 缓存管理器
 * 提供带 TTL 的内存缓存功能
 */

import type { CacheItem } from "@root/types/coze";

/**
 * 缓存管理类
 */
export class CozeApiCache {
  private cache = new Map<string, CacheItem>();

  // 缓存过期时间配置（毫秒）
  private readonly TTL = {
    workspaces: 30 * 60 * 1000, // 工作空间缓存30分钟
    workflows: 5 * 60 * 1000, // 工作流缓存5分钟
  };

  /**
   * 设置缓存
   */
  set<T>(key: string, data: T, type: "workspaces" | "workflows"): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: this.TTL[type],
    });
  }

  /**
   * 获取缓存
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) {
      return null;
    }

    // 检查是否过期
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data as T;
  }

  /**
   * 清除缓存
   */
  clear(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    // 清除匹配模式的缓存
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}