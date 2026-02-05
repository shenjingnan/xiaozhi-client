/**
 * CustomMCP 结果缓存管理器
 * 负责 CustomMCP 工具执行结果的缓存管理
 */

import type { Logger } from "@/Logger.js";
import { logger } from "@/Logger.js";
import { CACHE_TIMEOUTS, MCP_CACHE_VERSIONS } from "@/constants/index.js";
import type {
  CacheStatistics,
  EnhancedToolResultCache,
  ExtendedMCPToolsCache,
  TaskStatus,
  ToolCallResult,
} from "@/types/index.js";
import { generateCacheKey, shouldCleanupCache } from "@/types/index.js";
import type { CacheFileStorage } from "./cache-storage.js";
import type { MCPToolsCache } from "./cache-tools.js";

/**
 * CustomMCP 结果缓存管理器
 * 负责管理 CustomMCP 工具的执行结果缓存
 */
export class CustomMCPResultCacheManager {
  private storage: CacheFileStorage;
  private logger: Logger;
  private readonly CACHE_VERSION = MCP_CACHE_VERSIONS.CACHE_VERSION;
  private readonly CLEANUP_INTERVAL = CACHE_TIMEOUTS.CLEANUP_INTERVAL;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(storage: CacheFileStorage) {
    this.storage = storage;
    this.logger = logger;
  }

  /**
   * 格式化时间戳为 YYYY-MM-DD HH:mm:ss 格式
   */
  private formatTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * 加载扩展缓存（包含 CustomMCP 结果）
   */
  private async loadExtendedCache(): Promise<ExtendedMCPToolsCache> {
    try {
      const cache = await this.storage.load();
      // 确保有 customMCPResults 字段
      const cacheWithCustom = cache as MCPToolsCache & {
        customMCPResults?: Record<string, unknown>;
      };
      if (!cacheWithCustom.customMCPResults) {
        cacheWithCustom.customMCPResults = {};
      }
      return cacheWithCustom as ExtendedMCPToolsCache;
    } catch (error) {
      this.logger.warn(
        `[CustomMCPResultCache] 加载扩展缓存失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return {
        version: this.CACHE_VERSION,
        mcpServers: {},
        metadata: {
          lastGlobalUpdate: this.formatTimestamp(),
          totalWrites: 0,
          createdAt: this.formatTimestamp(),
        },
        customMCPResults: {},
      };
    }
  }

  /**
   * 保存扩展缓存（包含 CustomMCP 结果）
   */
  private async saveExtendedCache(cache: ExtendedMCPToolsCache): Promise<void> {
    await this.storage.save(cache);
  }

  /**
   * 写入 CustomMCP 工具执行结果缓存
   */
  async writeResult(
    toolName: string,
    arguments_: Record<string, unknown>,
    result: ToolCallResult,
    status: TaskStatus = "completed",
    taskId?: string,
    ttl = 300000
  ): Promise<void> {
    try {
      const cache = await this.loadExtendedCache();
      const cacheKey = generateCacheKey(toolName, arguments_);

      // 创建缓存条目
      const cacheEntry: EnhancedToolResultCache = {
        result,
        timestamp: new Date().toISOString(),
        ttl,
        status,
        consumed: false,
        taskId,
        retryCount: 0,
      };

      // 确保customMCPResults存在
      if (!cache.customMCPResults) {
        cache.customMCPResults = {};
      }

      cache.customMCPResults[cacheKey] = cacheEntry;
      await this.saveExtendedCache(cache);

      this.logger.debug(
        `[CustomMCPResultCache] 写入CustomMCP结果缓存: ${toolName}, 状态: ${status}`
      );
    } catch (error) {
      this.logger.warn(
        `[CustomMCPResultCache] 写入CustomMCP结果缓存失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 读取 CustomMCP 工具执行结果缓存
   */
  async readResult(
    toolName: string,
    arguments_: Record<string, unknown>
  ): Promise<EnhancedToolResultCache | null> {
    try {
      const cache = await this.loadExtendedCache();
      const cacheKey = generateCacheKey(toolName, arguments_);

      if (!cache.customMCPResults || !cache.customMCPResults[cacheKey]) {
        return null;
      }

      const cacheEntry = cache.customMCPResults[cacheKey];

      // 检查是否过期
      const now = Date.now();
      const cachedTime = new Date(cacheEntry.timestamp).getTime();
      if (now - cachedTime > cacheEntry.ttl) {
        this.logger.debug(`[CustomMCPResultCache] 缓存已过期: ${toolName}`);
        return null;
      }

      return cacheEntry;
    } catch (error) {
      this.logger.warn(
        `[CustomMCPResultCache] 读取CustomMCP结果缓存失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
    }
  }

  /**
   * 更新 CustomMCP 缓存状态
   */
  async updateStatus(
    toolName: string,
    arguments_: Record<string, unknown>,
    newStatus: TaskStatus,
    result?: ToolCallResult,
    error?: string
  ): Promise<boolean> {
    try {
      const cache = await this.loadExtendedCache();
      const cacheKey = generateCacheKey(toolName, arguments_);

      if (!cache.customMCPResults || !cache.customMCPResults[cacheKey]) {
        return false;
      }

      const cacheEntry = cache.customMCPResults[cacheKey];
      const oldStatus = cacheEntry.status;

      // 更新状态
      cacheEntry.status = newStatus;
      cacheEntry.timestamp = new Date().toISOString();

      // 更新结果或错误信息
      if (result) {
        cacheEntry.result = result;
      }

      if (error && newStatus === "failed") {
        cacheEntry.result = {
          content: [{ type: "text", text: `任务失败: ${error}` }],
        };
        cacheEntry.consumed = true; // 失败的任务自动标记为已消费
      }

      // 特殊状态处理
      if (newStatus === "completed") {
        cacheEntry.consumed = false; // 完成的任务初始状态为未消费
      }

      await this.saveExtendedCache(cache);

      this.logger.debug(
        `[CustomMCPResultCache] 更新缓存状态: ${toolName} ${oldStatus} -> ${newStatus}`
      );
      return true;
    } catch (error) {
      this.logger.warn(
        `[CustomMCPResultCache] 更新CustomMCP缓存状态失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return false;
    }
  }

  /**
   * 标记 CustomMCP 缓存为已消费
   */
  async markAsConsumed(
    toolName: string,
    arguments_: Record<string, unknown>
  ): Promise<boolean> {
    try {
      const cache = await this.loadExtendedCache();
      const cacheKey = generateCacheKey(toolName, arguments_);

      if (!cache.customMCPResults || !cache.customMCPResults[cacheKey]) {
        return false;
      }

      const cacheEntry = cache.customMCPResults[cacheKey];
      if (cacheEntry.consumed) {
        return true;
      }

      cacheEntry.consumed = true;
      cacheEntry.timestamp = new Date().toISOString();

      await this.saveExtendedCache(cache);

      this.logger.debug(`[CustomMCPResultCache] 标记缓存为已消费: ${toolName}`);
      return true;
    } catch (error) {
      this.logger.warn(
        `[CustomMCPResultCache] 标记CustomMCP缓存为已消费失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return false;
    }
  }

  /**
   * 删除 CustomMCP 缓存条目
   */
  async deleteResult(
    toolName: string,
    arguments_: Record<string, unknown>
  ): Promise<boolean> {
    try {
      const cache = await this.loadExtendedCache();
      const cacheKey = generateCacheKey(toolName, arguments_);

      if (!cache.customMCPResults || !cache.customMCPResults[cacheKey]) {
        return false;
      }

      delete cache.customMCPResults[cacheKey];
      await this.saveExtendedCache(cache);

      this.logger.debug(`[CustomMCPResultCache] 删除缓存条目: ${toolName}`);
      return true;
    } catch (error) {
      this.logger.warn(
        `[CustomMCPResultCache] 删除CustomMCP缓存条目失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return false;
    }
  }

  /**
   * 批量清理 CustomMCP 缓存
   */
  async cleanupExpired(): Promise<{ cleaned: number; total: number }> {
    try {
      const cache = await this.loadExtendedCache();

      if (!cache.customMCPResults) {
        return { cleaned: 0, total: 0 };
      }

      const entries = Object.entries(cache.customMCPResults);
      let cleanedCount = 0;

      for (const [cacheKey, cacheEntry] of entries) {
        if (shouldCleanupCache(cacheEntry)) {
          delete cache.customMCPResults[cacheKey];
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        await this.saveExtendedCache(cache);
        this.logger.info(
          `[CustomMCPResultCache] 清理CustomMCP缓存: ${cleanedCount}/${entries.length}`
        );
      }

      return { cleaned: cleanedCount, total: entries.length };
    } catch (error) {
      this.logger.warn(
        `[CustomMCPResultCache] 清理CustomMCP缓存失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return { cleaned: 0, total: 0 };
    }
  }

  /**
   * 获取 CustomMCP 缓存统计信息
   */
  async getStatistics(): Promise<CacheStatistics> {
    try {
      const cache = await this.loadExtendedCache();

      if (!cache.customMCPResults) {
        return {
          totalEntries: 0,
          pendingTasks: 0,
          completedTasks: 0,
          failedTasks: 0,
          consumedEntries: 0,
          cacheHitRate: 0,
          lastCleanupTime: new Date().toISOString(),
          memoryUsage: 0,
        };
      }

      const entries = Object.values(cache.customMCPResults);
      const totalEntries = entries.length;
      const pendingTasks = entries.filter((e) => e.status === "pending").length;
      const completedTasks = entries.filter(
        (e) => e.status === "completed"
      ).length;
      const failedTasks = entries.filter((e) => e.status === "failed").length;
      const consumedEntries = entries.filter((e) => e.consumed).length;

      // 计算缓存命中率
      const cacheHitRate =
        completedTasks > 0 ? (consumedEntries / completedTasks) * 100 : 0;

      // 估算内存使用
      const memoryUsage = JSON.stringify(cache.customMCPResults).length;

      return {
        totalEntries,
        pendingTasks,
        completedTasks,
        failedTasks,
        consumedEntries,
        cacheHitRate,
        lastCleanupTime: new Date().toISOString(),
        memoryUsage,
      };
    } catch (error) {
      this.logger.warn(
        `[CustomMCPResultCache] 获取CustomMCP缓存统计失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return {
        totalEntries: 0,
        pendingTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        consumedEntries: 0,
        cacheHitRate: 0,
        lastCleanupTime: new Date().toISOString(),
        memoryUsage: 0,
      };
    }
  }

  /**
   * 启动自动清理定时器
   */
  startAutoCleanup(): void {
    if (this.cleanupInterval) {
      this.logger.debug("[CustomMCPResultCache] 清理定时器已在运行");
      return;
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired().catch((error) => {
        this.logger.warn(`[CustomMCPResultCache] 自动清理失败: ${error}`);
      });
    }, this.CLEANUP_INTERVAL);

    this.logger.debug(
      `[CustomMCPResultCache] 启动清理定时器，间隔: ${this.CLEANUP_INTERVAL}ms`
    );
  }

  /**
   * 停止自动清理定时器
   */
  stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
      this.logger.debug("[CustomMCPResultCache] 停止清理定时器");
    }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.stopAutoCleanup();
    this.logger.debug("[CustomMCPResultCache] 清理资源完成");
  }
}
