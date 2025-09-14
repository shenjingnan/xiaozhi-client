/**
 * 缓存生命周期管理器
 * 负责管理 CustomMCP 工具执行结果的缓存生命周期
 * 实现一次性缓存机制和自动清理策略
 */

import type { Logger } from "../Logger.js";
import type {
  CacheStateTransition,
  CacheStatistics,
  EnhancedToolResultCache,
  ExtendedMCPToolsCache,
  TaskStatus,
} from "../types/mcp.js";
import {
  DEFAULT_CONFIG,
  generateCacheKey,
  isCacheExpired,
  shouldCleanupCache,
} from "../types/mcp.js";

/**
 * 缓存生命周期管理器
 */
export class CacheLifecycleManager {
  private logger: Logger;
  private cleanupInterval?: NodeJS.Timeout;
  private statistics: CacheStatistics;
  private lastCleanupTime: string;

  constructor(logger: Logger) {
    this.logger = logger;
    this.statistics = this.initializeStatistics();
    this.lastCleanupTime = new Date().toISOString();
  }

  /**
   * 初始化统计信息
   */
  private initializeStatistics(): CacheStatistics {
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

  /**
   * 启动自动清理定时器
   */
  public startAutoCleanup(): void {
    if (this.cleanupInterval) {
      this.logger.warn("[CacheLifecycle] 自动清理定时器已经在运行");
      return;
    }

    this.cleanupInterval = setInterval(() => {
      this.performCleanup().catch((error) => {
        this.logger.error(`[CacheLifecycle] 自动清理失败: ${error}`);
      });
    }, DEFAULT_CONFIG.CLEANUP_INTERVAL);

    this.logger.info(
      `[CacheLifecycle] 启动自动清理定时器，间隔: ${DEFAULT_CONFIG.CLEANUP_INTERVAL}ms`
    );
  }

  /**
   * 停止自动清理定时器
   */
  public stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
      this.logger.info("[CacheLifecycle] 停止自动清理定时器");
    }
  }

  /**
   * 创建新的缓存条目
   */
  public createCacheEntry(
    toolName: string,
    arguments_: any,
    result: any,
    status: TaskStatus = "pending",
    taskId?: string
  ): EnhancedToolResultCache {
    const cacheEntry: EnhancedToolResultCache = {
      result,
      timestamp: new Date().toISOString(),
      ttl: DEFAULT_CONFIG.CACHE_TTL,
      status,
      consumed: false,
      taskId,
      retryCount: 0,
    };

    this.logger.debug(
      `[CacheLifecycle] 创建缓存条目: ${toolName}, 状态: ${status}`
    );
    return cacheEntry;
  }

  /**
   * 更新缓存条目状态
   */
  public updateCacheStatus(
    cache: ExtendedMCPToolsCache,
    cacheKey: string,
    newStatus: TaskStatus,
    result?: any,
    error?: string
  ): boolean {
    if (!cache.customMCPResults || !cache.customMCPResults[cacheKey]) {
      this.logger.warn(`[CacheLifecycle] 缓存条目不存在: ${cacheKey}`);
      return false;
    }

    const cacheEntry = cache.customMCPResults[cacheKey];
    const oldStatus = cacheEntry.status;

    // 记录状态转换
    this.logStateTransition(cacheKey, oldStatus, newStatus);

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

    this.logger.debug(
      `[CacheLifecycle] 更新缓存状态: ${cacheKey} ${oldStatus} -> ${newStatus}`
    );
    return true;
  }

  /**
   * 标记缓存为已消费
   */
  public markAsConsumed(
    cache: ExtendedMCPToolsCache,
    cacheKey: string
  ): boolean {
    if (!cache.customMCPResults || !cache.customMCPResults[cacheKey]) {
      return false;
    }

    const cacheEntry = cache.customMCPResults[cacheKey];
    if (cacheEntry.consumed) {
      this.logger.debug(`[CacheLifecycle] 缓存已标记为消费: ${cacheKey}`);
      return true;
    }

    cacheEntry.consumed = true;
    cacheEntry.timestamp = new Date().toISOString();

    this.logStateTransition(cacheKey, cacheEntry.status, "consumed");
    this.logger.debug(`[CacheLifecycle] 标记缓存为已消费: ${cacheKey}`);

    return true;
  }

  /**
   * 检查缓存是否可用
   */
  public isCacheAvailable(
    cache: ExtendedMCPToolsCache,
    cacheKey: string
  ): boolean {
    if (!cache.customMCPResults || !cache.customMCPResults[cacheKey]) {
      return false;
    }

    const cacheEntry = cache.customMCPResults[cacheKey];

    // 检查是否已过期
    if (isCacheExpired(cacheEntry.timestamp, cacheEntry.ttl)) {
      this.logger.debug(`[CacheLifecycle] 缓存已过期: ${cacheKey}`);
      return false;
    }

    // 检查是否已消费
    if (cacheEntry.consumed) {
      this.logger.debug(`[CacheLifecycle] 缓存已消费: ${cacheKey}`);
      return false;
    }

    // 检查状态是否为已完成
    if (cacheEntry.status !== "completed") {
      this.logger.debug(
        `[CacheLifecycle] 缓存状态未完成: ${cacheKey}, 状态: ${cacheEntry.status}`
      );
      return false;
    }

    return true;
  }

  /**
   * 执行缓存清理
   */
  public async performCleanup(): Promise<void> {
    try {
      // 注意：这里需要从外部传入缓存数据
      // 实际的清理逻辑会在集成到 MCPCacheManager 时实现
      this.logger.debug("[CacheLifecycle] 执行缓存清理");
      this.lastCleanupTime = new Date().toISOString();
    } catch (error) {
      this.logger.error(`[CacheLifecycle] 清理失败: ${error}`);
      throw error;
    }
  }

  /**
   * 清理指定的缓存条目
   */
  public cleanupCacheEntries(
    cache: ExtendedMCPToolsCache,
    cacheKeys?: string[]
  ): { cleaned: number; total: number } {
    if (!cache.customMCPResults) {
      return { cleaned: 0, total: 0 };
    }

    const entries = Object.entries(cache.customMCPResults);
    let cleanedCount = 0;

    const keysToClean = cacheKeys || entries.map(([key]) => key);

    for (const cacheKey of keysToClean) {
      const cacheEntry = cache.customMCPResults[cacheKey];
      if (cacheEntry && shouldCleanupCache(cacheEntry)) {
        delete cache.customMCPResults[cacheKey];
        cleanedCount++;
        this.logger.debug(`[CacheLifecycle] 清理缓存条目: ${cacheKey}`);
      }
    }

    this.logger.info(
      `[CacheLifecycle] 清理完成: ${cleanedCount}/${keysToClean.length}`
    );
    return { cleaned: cleanedCount, total: keysToClean.length };
  }

  /**
   * 批量清理过期缓存
   */
  public cleanupExpiredCache(cache: ExtendedMCPToolsCache): {
    cleaned: number;
    total: number;
  } {
    if (!cache.customMCPResults) {
      return { cleaned: 0, total: 0 };
    }

    const entries = Object.entries(cache.customMCPResults);
    let cleanedCount = 0;

    for (const [cacheKey, cacheEntry] of entries) {
      if (isCacheExpired(cacheEntry.timestamp, cacheEntry.ttl)) {
        delete cache.customMCPResults[cacheKey];
        cleanedCount++;
        this.logger.debug(`[CacheLifecycle] 清理过期缓存: ${cacheKey}`);
      }
    }

    if (cleanedCount > 0) {
      this.logger.info(
        `[CacheLifecycle] 清理过期缓存: ${cleanedCount}/${entries.length}`
      );
    }
    return { cleaned: cleanedCount, total: entries.length };
  }

  /**
   * 清理已消费的缓存
   */
  public cleanupConsumedCache(cache: ExtendedMCPToolsCache): {
    cleaned: number;
    total: number;
  } {
    if (!cache.customMCPResults) {
      return { cleaned: 0, total: 0 };
    }

    const entries = Object.entries(cache.customMCPResults);
    let cleanedCount = 0;
    const now = Date.now();

    for (const [cacheKey, cacheEntry] of entries) {
      if (cacheEntry.consumed) {
        const cachedTime = new Date(cacheEntry.timestamp).getTime();
        // 已消费且超过清理时间（1分钟）
        if (now - cachedTime > 60000) {
          delete cache.customMCPResults[cacheKey];
          cleanedCount++;
          this.logger.debug(`[CacheLifecycle] 清理已消费缓存: ${cacheKey}`);
        }
      }
    }

    if (cleanedCount > 0) {
      this.logger.info(
        `[CacheLifecycle] 清理已消费缓存: ${cleanedCount}/${entries.length}`
      );
    }
    return { cleaned: cleanedCount, total: entries.length };
  }

  /**
   * 更新统计信息
   */
  public updateStatistics(cache: ExtendedMCPToolsCache): void {
    if (!cache.customMCPResults) {
      this.statistics = this.initializeStatistics();
      return;
    }

    const entries = Object.values(cache.customMCPResults);
    this.statistics.totalEntries = entries.length;
    this.statistics.pendingTasks = entries.filter(
      (e) => e.status === "pending"
    ).length;
    this.statistics.completedTasks = entries.filter(
      (e) => e.status === "completed"
    ).length;
    this.statistics.failedTasks = entries.filter(
      (e) => e.status === "failed"
    ).length;
    this.statistics.consumedEntries = entries.filter((e) => e.consumed).length;

    // 计算缓存命中率（简化计算）
    const totalCompleted = this.statistics.completedTasks;
    const totalConsumed = this.statistics.consumedEntries;
    this.statistics.cacheHitRate =
      totalCompleted > 0 ? (totalConsumed / totalCompleted) * 100 : 0;

    this.statistics.lastCleanupTime = this.lastCleanupTime;

    // 估算内存使用（简化计算）
    this.statistics.memoryUsage = JSON.stringify(cache.customMCPResults).length;
  }

  /**
   * 获取统计信息
   */
  public getStatistics(): CacheStatistics {
    return { ...this.statistics };
  }

  /**
   * 验证缓存完整性
   */
  public validateCacheIntegrity(cache: ExtendedMCPToolsCache): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    if (!cache.customMCPResults) {
      return { isValid: true, issues: [] };
    }

    for (const [cacheKey, cacheEntry] of Object.entries(
      cache.customMCPResults
    )) {
      // 验证必需字段
      if (!cacheEntry.timestamp || !cacheEntry.ttl || !cacheEntry.status) {
        issues.push(`缓存条目缺少必需字段: ${cacheKey}`);
      }

      // 验证时间戳格式
      if (Number.isNaN(new Date(cacheEntry.timestamp).getTime())) {
        issues.push(`无效的时间戳格式: ${cacheKey}`);
      }

      // 验证状态值
      const validStatuses: TaskStatus[] = ["pending", "completed", "failed"];
      if (!validStatuses.includes(cacheEntry.status)) {
        issues.push(`无效的状态值: ${cacheKey}, 状态: ${cacheEntry.status}`);
      }

      // 验证过期条目
      if (isCacheExpired(cacheEntry.timestamp, cacheEntry.ttl)) {
        issues.push(`缓存条目已过期: ${cacheKey}`);
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  /**
   * 记录状态转换
   */
  private logStateTransition(
    cacheKey: string,
    fromStatus: TaskStatus,
    toStatus: TaskStatus
  ): void {
    const transition: CacheStateTransition = {
      from: fromStatus,
      to: toStatus,
      reason: this.getTransitionReason(fromStatus, toStatus),
      timestamp: new Date().toISOString(),
    };

    this.logger.debug(
      `[CacheLifecycle] 状态转换: ${cacheKey} ${fromStatus} -> ${toStatus} (${transition.reason})`
    );
  }

  /**
   * 获取状态转换原因
   */
  private getTransitionReason(
    fromStatus: TaskStatus,
    toStatus: TaskStatus
  ): string {
    const reasons: Record<string, string> = {
      "pending->completed": "任务执行成功",
      "pending->failed": "任务执行失败",
      "completed->consumed": "结果被消费",
      "failed->consumed": "失败结果被处理",
      "consumed->deleted": "缓存被清理",
    };

    return reasons[`${fromStatus}->${toStatus}`] || "状态更新";
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.stopAutoCleanup();
    this.logger.info("[CacheLifecycle] 清理资源完成");
  }
}
