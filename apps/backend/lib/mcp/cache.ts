/**
 * MCP 缓存管理器
 * 负责 MCP 服务工具列表的缓存写入功能
 * 专注于缓存文件管理和数据写入的基础设施
 */

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import type { MCPServiceConfig } from "@/lib/mcp/types";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { Logger } from "@root/Logger.js";
import { logger } from "@root/Logger.js";
import type {
  CacheStatistics,
  EnhancedToolResultCache,
  ExtendedMCPToolsCache,
  TaskStatus,
} from "@root/types/index.js";
import { generateCacheKey, shouldCleanupCache } from "@root/types/index.js";
import dayjs from "dayjs";

// 缓存条目接口
export interface MCPToolsCacheEntry {
  tools: Tool[]; // 工具列表
  lastUpdated: string; // 最后更新时间 (YYYY-MM-DD HH:mm:ss)
  serverConfig: MCPServiceConfig; // 服务配置快照
  configHash: string; // 配置哈希值，用于快速变更检测
  version: string; // 缓存条目版本
}

// 缓存文件接口
export interface MCPToolsCache {
  version: string; // 缓存文件格式版本 "1.0.0"
  mcpServers: Record<string, MCPToolsCacheEntry>;
  metadata: {
    lastGlobalUpdate: string; // 全局最后更新时间 (YYYY-MM-DD HH:mm:ss)
    totalWrites: number; // 总写入次数
    createdAt: string; // 缓存文件创建时间 (YYYY-MM-DD HH:mm:ss)
  };
}

// 缓存统计接口
export interface CacheStats {
  totalWrites: number;
  lastUpdate: string;
  serverCount: number;
  cacheFileSize: number;
}

// 重新导出相关类型
export type {
  CacheStatistics,
  EnhancedToolResultCache,
  ExtendedMCPToolsCache,
} from "@root/types/index.js";

export class MCPCacheManager {
  private cachePath: string;
  private logger: Logger;
  private readonly CACHE_VERSION = "1.0.0";
  private readonly CACHE_ENTRY_VERSION = "1.0.0";
  private cleanupInterval?: NodeJS.Timeout;
  private readonly CLEANUP_INTERVAL = 60000; // 1分钟清理间隔

  constructor(customCachePath?: string) {
    this.logger = logger;
    this.cachePath = customCachePath || this.getCacheFilePath();
    this.startCleanupTimer();
  }

  /**
   * 格式化时间戳为 YYYY-MM-DD HH:mm:ss 格式
   */
  private formatTimestamp(): string {
    return dayjs().format("YYYY-MM-DD HH:mm:ss");
  }

  /**
   * 获取缓存文件路径
   * 与 xiaozhi.config.json 同级目录
   */
  private getCacheFilePath(): string {
    try {
      const configDir = process.env.XIAOZHI_CONFIG_DIR || process.cwd();
      return resolve(configDir, "xiaozhi.cache.json");
    } catch (error) {
      // 在某些测试环境中 process.cwd() 可能不可用，使用默认路径
      const configDir = process.env.XIAOZHI_CONFIG_DIR || "/tmp";
      return resolve(configDir, "xiaozhi.cache.json");
    }
  }

  /**
   * 确保缓存文件存在，如不存在则创建
   */
  async ensureCacheFile(): Promise<void> {
    try {
      if (!existsSync(this.cachePath)) {
        // 确保缓存文件的目录存在
        const cacheDir = dirname(this.cachePath);
        if (!existsSync(cacheDir)) {
          mkdirSync(cacheDir, { recursive: true });
          this.logger.debug(`[CacheManager] 已创建缓存目录: ${cacheDir}`);
        }

        this.logger.debug("[CacheManager] 缓存文件不存在，创建初始缓存文件");
        const initialCache = await this.createInitialCache();
        await this.saveCache(initialCache);
        this.logger.info(`[CacheManager] 已创建缓存文件: ${this.cachePath}`);
      }
    } catch (error) {
      this.logger.warn(
        `[CacheManager] 创建缓存文件失败: ${error instanceof Error ? error.message : String(error)}`
      );
      // 不抛出异常，确保不影响主流程
    }
  }

  /**
   * 创建初始缓存结构
   */
  private async createInitialCache(): Promise<MCPToolsCache> {
    const now = this.formatTimestamp();
    return {
      version: this.CACHE_VERSION,
      mcpServers: {},
      metadata: {
        lastGlobalUpdate: now,
        totalWrites: 0,
        createdAt: now,
      },
    };
  }

  /**
   * 写入缓存条目
   * @param serverName 服务名称
   * @param tools 工具列表
   * @param config 服务配置
   */
  async writeCacheEntry(
    serverName: string,
    tools: Tool[],
    config: MCPServiceConfig
  ): Promise<void> {
    try {
      this.logger.debug(`[CacheManager] 开始写入缓存: ${serverName}`);

      // 确保缓存文件存在
      await this.ensureCacheFile();

      // 加载现有缓存
      const cache = await this.loadExistingCache();

      // 生成配置哈希
      const configHash = this.generateConfigHash(config);

      // 创建缓存条目
      const cacheEntry: MCPToolsCacheEntry = {
        tools: tools.map((tool) => ({
          name: tool.name,
          description: tool.description || "",
          inputSchema: tool.inputSchema,
        })),
        lastUpdated: this.formatTimestamp(),
        serverConfig: { ...config }, // 深拷贝配置
        configHash,
        version: this.CACHE_ENTRY_VERSION,
      };

      // 更新缓存
      cache.mcpServers[serverName] = cacheEntry;
      cache.metadata.lastGlobalUpdate = this.formatTimestamp();
      cache.metadata.totalWrites += 1;

      // 保存缓存
      await this.saveCache(cache);

      this.logger.debug(
        `[CacheManager] 缓存写入成功: ${serverName}, 工具数量: ${tools.length}`
      );
    } catch (error) {
      // 记录错误但不抛出异常，确保不影响主流程
      this.logger.warn(
        `[CacheManager] 缓存写入失败: ${serverName}, 错误: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 加载现有缓存
   */
  public async loadExistingCache(): Promise<MCPToolsCache> {
    try {
      if (!existsSync(this.cachePath)) {
        return await this.createInitialCache();
      }

      const cacheData = readFileSync(this.cachePath, "utf8");
      const cache = JSON.parse(cacheData) as MCPToolsCache;

      // 验证缓存结构
      if (!this.validateCacheStructure(cache)) {
        this.logger.warn("[CacheManager] 缓存文件结构无效，重新创建");
        return await this.createInitialCache();
      }

      return cache;
    } catch (error) {
      this.logger.warn(
        `[CacheManager] 加载缓存失败，创建新缓存: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return await this.createInitialCache();
    }
  }

  /**
   * 保存缓存到文件（原子写入）
   */
  public async saveCache(cache: MCPToolsCache): Promise<void> {
    const cacheContent = JSON.stringify(cache, null, 2);
    await this.atomicWrite(this.cachePath, cacheContent);
  }

  /**
   * 原子写入文件
   * 使用临时文件确保写入操作的原子性
   */
  private async atomicWrite(filePath: string, data: string): Promise<void> {
    const tempPath = `${filePath}.tmp`;
    try {
      // 写入临时文件
      writeFileSync(tempPath, data, "utf8");
      // 原子性重命名
      renameSync(tempPath, filePath);
    } catch (error) {
      // 清理临时文件
      try {
        if (existsSync(tempPath)) {
          writeFileSync(tempPath, "", "utf8"); // 清空后删除
        }
      } catch {
        // 忽略清理错误
      }
      throw error;
    }
  }

  /**
   * 生成配置哈希
   * 用于快速检测配置变更
   */
  private generateConfigHash(config: MCPServiceConfig): string {
    try {
      return createHash("sha256").update(JSON.stringify(config)).digest("hex");
    } catch (error) {
      this.logger.warn(
        `[CacheManager] 生成配置哈希失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return "";
    }
  }

  /**
   * 验证缓存数据结构
   */
  private validateCacheStructure(cache: MCPToolsCache): boolean {
    try {
      return (
        cache &&
        typeof cache === "object" &&
        typeof cache.version === "string" &&
        typeof cache.mcpServers === "object" &&
        cache.metadata &&
        typeof cache.metadata === "object" &&
        typeof cache.metadata.lastGlobalUpdate === "string" &&
        typeof cache.metadata.totalWrites === "number" &&
        typeof cache.metadata.createdAt === "string"
      );
    } catch {
      return false;
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getStats(): Promise<CacheStats | null> {
    try {
      const cache = await this.loadExistingCache();
      const stats: CacheStats = {
        totalWrites: cache.metadata.totalWrites,
        lastUpdate: cache.metadata.lastGlobalUpdate,
        serverCount: Object.keys(cache.mcpServers).length,
        cacheFileSize: existsSync(this.cachePath)
          ? readFileSync(this.cachePath, "utf8").length
          : 0,
      };
      return stats;
    } catch (error) {
      this.logger.warn(
        `[CacheManager] 获取缓存统计失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
    }
  }

  /**
   * 获取缓存文件路径（用于测试和调试）
   */
  getFilePath(): string {
    return this.cachePath;
  }

  /**
   * 获取所有缓存中的工具
   * 返回所有服务中的所有工具列表
   */
  async getAllCachedTools(): Promise<Tool[]> {
    try {
      const cache = await this.loadExistingCache();
      const allTools: Tool[] = [];

      // 遍历所有服务，收集所有工具
      for (const [serverName, cacheEntry] of Object.entries(cache.mcpServers)) {
        for (const tool of cacheEntry.tools) {
          // 为每个工具添加服务名称信息
          allTools.push({
            ...tool,
            name: `${serverName}__${tool.name}`, // 格式: serviceName__toolName
          });
        }
      }

      this.logger.debug(
        `[CacheManager] 获取到所有缓存工具，共 ${allTools.length} 个`
      );
      return allTools;
    } catch (error) {
      this.logger.warn(
        `[CacheManager] 获取所有缓存工具失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return [];
    }
  }

  // ==================== CustomMCP 结果缓存管理方法 ====================

  /**
   * 写入 CustomMCP 工具执行结果缓存
   */
  async writeCustomMCPResult(
    toolName: string,
    arguments_: any,
    result: any,
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
        `[CacheManager] 写入CustomMCP结果缓存: ${toolName}, 状态: ${status}`
      );
    } catch (error) {
      this.logger.warn(
        `[CacheManager] 写入CustomMCP结果缓存失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 读取 CustomMCP 工具执行结果缓存
   */
  async readCustomMCPResult(
    toolName: string,
    arguments_: any
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
        this.logger.debug(`[CacheManager] 缓存已过期: ${toolName}`);
        return null;
      }

      return cacheEntry;
    } catch (error) {
      this.logger.warn(
        `[CacheManager] 读取CustomMCP结果缓存失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
    }
  }

  /**
   * 更新 CustomMCP 缓存状态
   */
  async updateCustomMCPStatus(
    toolName: string,
    arguments_: any,
    newStatus: TaskStatus,
    result?: any,
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
        `[CacheManager] 更新缓存状态: ${toolName} ${oldStatus} -> ${newStatus}`
      );
      return true;
    } catch (error) {
      this.logger.warn(
        `[CacheManager] 更新CustomMCP缓存状态失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return false;
    }
  }

  /**
   * 标记 CustomMCP 缓存为已消费
   */
  async markCustomMCPAsConsumed(
    toolName: string,
    arguments_: any
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

      this.logger.debug(`[CacheManager] 标记缓存为已消费: ${toolName}`);
      return true;
    } catch (error) {
      this.logger.warn(
        `[CacheManager] 标记CustomMCP缓存为已消费失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return false;
    }
  }

  /**
   * 删除 CustomMCP 缓存条目
   */
  async deleteCustomMCPResult(
    toolName: string,
    arguments_: any
  ): Promise<boolean> {
    try {
      const cache = await this.loadExtendedCache();
      const cacheKey = generateCacheKey(toolName, arguments_);

      if (!cache.customMCPResults || !cache.customMCPResults[cacheKey]) {
        return false;
      }

      delete cache.customMCPResults[cacheKey];
      await this.saveExtendedCache(cache);

      this.logger.debug(`[CacheManager] 删除缓存条目: ${toolName}`);
      return true;
    } catch (error) {
      this.logger.warn(
        `[CacheManager] 删除CustomMCP缓存条目失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return false;
    }
  }

  /**
   * 批量清理 CustomMCP 缓存
   */
  async cleanupCustomMCPResults(): Promise<{ cleaned: number; total: number }> {
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
          `[CacheManager] 清理CustomMCP缓存: ${cleanedCount}/${entries.length}`
        );
      }

      return { cleaned: cleanedCount, total: entries.length };
    } catch (error) {
      this.logger.warn(
        `[CacheManager] 清理CustomMCP缓存失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return { cleaned: 0, total: 0 };
    }
  }

  /**
   * 获取 CustomMCP 缓存统计信息
   */
  async getCustomMCPStatistics(): Promise<CacheStatistics> {
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
        `[CacheManager] 获取CustomMCP缓存统计失败: ${
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
   * 加载扩展缓存（包含 CustomMCP 结果）
   */
  async loadExtendedCache(): Promise<ExtendedMCPToolsCache> {
    try {
      const cache = await this.loadExistingCache();
      return cache as ExtendedMCPToolsCache;
    } catch (error) {
      this.logger.warn(
        `[CacheManager] 加载扩展缓存失败: ${
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
  async saveExtendedCache(cache: ExtendedMCPToolsCache): Promise<void> {
    await this.saveCache(cache as any);
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupCustomMCPResults().catch((error) => {
        this.logger.warn(`[CacheManager] 自动清理失败: ${error}`);
      });
    }, this.CLEANUP_INTERVAL);

    this.logger.debug(
      `[CacheManager] 启动清理定时器，间隔: ${this.CLEANUP_INTERVAL}ms`
    );
  }

  /**
   * 停止清理定时器
   */
  public stopCleanupTimer(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
      this.logger.debug("[CacheManager] 停止清理定时器");
    }
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.stopCleanupTimer();
    this.logger.debug("[CacheManager] 清理资源完成");
  }
}