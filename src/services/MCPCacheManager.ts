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
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import dayjs from "dayjs";
import { type Logger, logger } from "../Logger.js";
import type { MCPServiceConfig } from "./MCPService.js";

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

export class MCPCacheManager {
  private cachePath: string;
  private logger: Logger;
  private readonly CACHE_VERSION = "1.0.0";
  private readonly CACHE_ENTRY_VERSION = "1.0.0";

  constructor(customCachePath?: string) {
    this.logger = logger;
    this.cachePath = customCachePath || this.getCacheFilePath();
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

      this.logger.info(
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
  private async loadExistingCache(): Promise<MCPToolsCache> {
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
  private async saveCache(cache: MCPToolsCache): Promise<void> {
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
  private validateCacheStructure(cache: any): cache is MCPToolsCache {
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
}
