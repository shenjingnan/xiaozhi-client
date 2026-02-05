/**
 * MCP 缓存管理器（向后兼容入口）
 * 为了保持向后兼容性，此文件重新导出新拆分的类
 *
 * @deprecated 推荐直接使用专门的类：
 * - CacheFileStorage: 文件存储服务
 * - MCPToolsCacheManager: MCP 工具列表缓存管理
 * - CustomMCPResultCacheManager: CustomMCP 结果缓存管理
 */

// 导出基础存储服务
export { CacheFileStorage } from "./cache-storage.js";

// 导出专门的缓存管理器
export {
  MCPToolsCacheManager,
  type MCPToolsCache,
  type MCPToolsCacheEntry,
  type CacheStats,
} from "./cache-tools.js";

export { CustomMCPResultCacheManager } from "./cache-custom.js";

// 重新导出类型（向后兼容）
export type {
  CacheStatistics,
  EnhancedToolResultCache,
  ExtendedMCPToolsCache,
} from "@/types/index.js";

// 从新模块重新导出类型
export type {
  MCPToolsCacheEntry as DeprecatedMCPToolsCacheEntry,
  CacheStats as DeprecatedCacheStats,
} from "./cache-tools.js";
import type { MCPServiceConfig } from "@/lib/mcp/types";
import type {
  CacheStatistics,
  EnhancedToolResultCache,
  ExtendedMCPToolsCache,
  TaskStatus,
  ToolCallResult,
} from "@/types/index.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { CustomMCPResultCacheManager } from "./cache-custom.js";
import { CacheFileStorage } from "./cache-storage.js";
import { type CacheStats, MCPToolsCacheManager } from "./cache-tools.js";

/**
 * MCPCacheManager 类（向后兼容）
 * 此类组合了三个专门的缓存管理器，保持向后兼容性
 *
 * @deprecated 推荐直接使用专门的类
 */
export class MCPCacheManager {
  private storage: CacheFileStorage;
  private toolsCacheManager: MCPToolsCacheManager;
  private resultCacheManager: CustomMCPResultCacheManager;

  constructor(customCachePath?: string) {
    // 创建共享的存储服务
    this.storage = new CacheFileStorage(customCachePath);

    // 创建专门的缓存管理器
    this.toolsCacheManager = new MCPToolsCacheManager(this.storage);
    this.resultCacheManager = new CustomMCPResultCacheManager(this.storage);

    // 启动自动清理定时器（为了向后兼容）
    this.resultCacheManager.startAutoCleanup();
  }

  // ==================== MCP 工具列表缓存方法（委托给 MCPToolsCacheManager）====================

  /**
   * 写入缓存条目
   * @deprecated 使用 MCPToolsCacheManager.writeCacheEntry
   */
  async writeCacheEntry(
    serverName: string,
    tools: Tool[],
    config: MCPServiceConfig
  ): Promise<void> {
    return this.toolsCacheManager.writeCacheEntry(serverName, tools, config);
  }

  /**
   * 加载现有缓存
   * @deprecated 使用 CacheFileStorage.load
   */
  public async loadExistingCache(): Promise<ExtendedMCPToolsCache> {
    return this.storage.load<ExtendedMCPToolsCache>();
  }

  /**
   * 保存缓存到文件
   * @deprecated 使用 CacheFileStorage.save
   */
  public async saveCache(cache: ExtendedMCPToolsCache): Promise<void> {
    return this.storage.save(cache);
  }

  /**
   * 获取缓存统计信息
   * @deprecated 使用 MCPToolsCacheManager.getStats
   */
  async getStats(): Promise<CacheStats | null> {
    return this.toolsCacheManager.getStats();
  }

  /**
   * 获取缓存文件路径
   * @deprecated 使用 CacheFileStorage.getFilePath
   */
  getFilePath(): string {
    return this.storage.getFilePath();
  }

  /**
   * 确保缓存文件存在
   * @deprecated 使用 CacheFileStorage.ensureCacheFile
   */
  async ensureCacheFile(): Promise<void> {
    return this.storage.ensureCacheFile();
  }

  /**
   * 获取所有缓存中的工具
   * @deprecated 使用 MCPToolsCacheManager.getAllCachedTools
   */
  async getAllCachedTools(): Promise<Tool[]> {
    return this.toolsCacheManager.getAllCachedTools();
  }

  // ==================== CustomMCP 结果缓存管理方法（委托给 CustomMCPResultCacheManager）====================

  /**
   * 写入 CustomMCP 工具执行结果缓存
   * @deprecated 使用 CustomMCPResultCacheManager.writeResult
   */
  async writeCustomMCPResult(
    toolName: string,
    arguments_: Record<string, unknown>,
    result: ToolCallResult,
    status: TaskStatus = "completed",
    taskId?: string,
    ttl = 300000
  ): Promise<void> {
    return this.resultCacheManager.writeResult(
      toolName,
      arguments_,
      result,
      status,
      taskId,
      ttl
    );
  }

  /**
   * 读取 CustomMCP 工具执行结果缓存
   * @deprecated 使用 CustomMCPResultCacheManager.readResult
   */
  async readCustomMCPResult(
    toolName: string,
    arguments_: Record<string, unknown>
  ): Promise<EnhancedToolResultCache | null> {
    return this.resultCacheManager.readResult(toolName, arguments_);
  }

  /**
   * 更新 CustomMCP 缓存状态
   * @deprecated 使用 CustomMCPResultCacheManager.updateStatus
   */
  async updateCustomMCPStatus(
    toolName: string,
    arguments_: Record<string, unknown>,
    newStatus: TaskStatus,
    result?: ToolCallResult,
    error?: string
  ): Promise<boolean> {
    return this.resultCacheManager.updateStatus(
      toolName,
      arguments_,
      newStatus,
      result,
      error
    );
  }

  /**
   * 标记 CustomMCP 缓存为已消费
   * @deprecated 使用 CustomMCPResultCacheManager.markAsConsumed
   */
  async markCustomMCPAsConsumed(
    toolName: string,
    arguments_: Record<string, unknown>
  ): Promise<boolean> {
    return this.resultCacheManager.markAsConsumed(toolName, arguments_);
  }

  /**
   * 删除 CustomMCP 缓存条目
   * @deprecated 使用 CustomMCPResultCacheManager.deleteResult
   */
  async deleteCustomMCPResult(
    toolName: string,
    arguments_: Record<string, unknown>
  ): Promise<boolean> {
    return this.resultCacheManager.deleteResult(toolName, arguments_);
  }

  /**
   * 批量清理 CustomMCP 缓存
   * @deprecated 使用 CustomMCPResultCacheManager.cleanupExpired
   */
  async cleanupCustomMCPResults(): Promise<{
    cleaned: number;
    total: number;
  }> {
    return this.resultCacheManager.cleanupExpired();
  }

  /**
   * 获取 CustomMCP 缓存统计信息
   * @deprecated 使用 CustomMCPResultCacheManager.getStatistics
   */
  async getCustomMCPStatistics(): Promise<CacheStatistics> {
    return this.resultCacheManager.getStatistics();
  }

  // ==================== 资源管理方法 ====================

  /**
   * 停止清理定时器
   * @deprecated 使用 CustomMCPResultCacheManager.stopAutoCleanup
   */
  public stopCleanupTimer(): void {
    this.resultCacheManager.stopAutoCleanup();
  }

  /**
   * 清理资源
   * @deprecated 使用 CustomMCPResultCacheManager.cleanup
   */
  public cleanup(): void {
    this.resultCacheManager.cleanup();
  }
}
