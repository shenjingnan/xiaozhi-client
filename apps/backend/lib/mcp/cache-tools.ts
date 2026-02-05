/**
 * MCP 工具列表缓存管理器
 * 负责 MCP 服务工具列表的缓存管理
 */

import { createHash } from "node:crypto";
import type { Logger } from "@/Logger.js";
import { logger } from "@/Logger.js";
import { MCP_CACHE_VERSIONS, TOOL_NAME_SEPARATORS } from "@/constants/index.js";
import type { MCPServiceConfig } from "@/lib/mcp/types";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { CacheFileStorage } from "./cache-storage.js";

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

/**
 * MCP 工具列表缓存管理器
 * 负责管理 MCP 服务工具列表的缓存
 */
export class MCPToolsCacheManager {
  private storage: CacheFileStorage;
  private logger: Logger;
  private readonly CACHE_VERSION = MCP_CACHE_VERSIONS.CACHE_VERSION;
  private readonly CACHE_ENTRY_VERSION = MCP_CACHE_VERSIONS.CACHE_ENTRY_VERSION;

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
      this.logger.debug(`[MCPToolsCache] 开始写入缓存: ${serverName}`);

      // 确保缓存文件存在
      await this.storage.ensureCacheFile();

      // 加载现有缓存
      const cache = await this.storage.load();

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
      await this.storage.save(cache);

      this.logger.debug(
        `[MCPToolsCache] 缓存写入成功: ${serverName}, 工具数量: ${tools.length}`
      );
    } catch (error) {
      // 记录错误但不抛出异常，确保不影响主流程
      this.logger.warn(
        `[MCPToolsCache] 缓存写入失败: ${serverName}, 错误: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 获取所有缓存中的工具
   * 返回所有服务中的所有工具列表
   */
  async getAllCachedTools(): Promise<Tool[]> {
    try {
      const cache = await this.storage.load();
      const allTools: Tool[] = [];

      // 遍历所有服务，收集所有工具
      for (const [serverName, cacheEntry] of Object.entries(cache.mcpServers)) {
        for (const tool of cacheEntry.tools) {
          // 为每个工具添加服务名称信息
          allTools.push({
            ...tool,
            name: `${serverName}${TOOL_NAME_SEPARATORS.SERVICE_TOOL_SEPARATOR}${tool.name}`, // 格式: serviceName__toolName
          });
        }
      }

      this.logger.debug(
        `[MCPToolsCache] 获取到所有缓存工具，共 ${allTools.length} 个`
      );
      return allTools;
    } catch (error) {
      this.logger.warn(
        `[MCPToolsCache] 获取所有缓存工具失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return [];
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getStats(): Promise<CacheStats | null> {
    try {
      const cache = await this.storage.load();
      const stats: CacheStats = {
        totalWrites: cache.metadata.totalWrites,
        lastUpdate: cache.metadata.lastGlobalUpdate,
        serverCount: Object.keys(cache.mcpServers).length,
        cacheFileSize: this.storage.getFileSize(),
      };
      return stats;
    } catch (error) {
      this.logger.warn(
        `[MCPToolsCache] 获取缓存统计失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
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
        `[MCPToolsCache] 生成配置哈希失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return "";
    }
  }
}
