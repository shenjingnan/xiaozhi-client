/**
 * 缓存文件存储服务
 * 负责缓存文件的读写操作和基础存储管理
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import type { Logger } from "@/Logger.js";
import { logger } from "@/Logger.js";
import { CACHE_FILE_CONFIG, MCP_CACHE_VERSIONS } from "@/constants/index.js";
import type { MCPToolsCache } from "./cache-tools.js";

/**
 * 缓存文件存储服务
 * 提供缓存文件的原子读写操作
 */
export class CacheFileStorage {
  private cachePath: string;
  private logger: Logger;
  private readonly CACHE_VERSION = MCP_CACHE_VERSIONS.CACHE_VERSION;

  constructor(customCachePath?: string) {
    this.logger = logger;
    this.cachePath = customCachePath || this.getCacheFilePath();
  }

  /**
   * 获取缓存文件路径
   */
  private getCacheFilePath(): string {
    try {
      const configDir = process.env.XIAOZHI_CONFIG_DIR || process.cwd();
      return resolve(configDir, CACHE_FILE_CONFIG.FILENAME);
    } catch {
      // 在某些测试环境中 process.cwd() 可能不可用，使用默认路径
      const configDir = process.env.XIAOZHI_CONFIG_DIR || "/tmp";
      return resolve(configDir, CACHE_FILE_CONFIG.FILENAME);
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
          this.logger.debug(`[CacheStorage] 已创建缓存目录: ${cacheDir}`);
        }

        this.logger.debug("[CacheStorage] 缓存文件不存在，创建初始缓存文件");
        const initialCache = await this.createInitialCache();
        await this.save(initialCache);
        this.logger.info(`[CacheStorage] 已创建缓存文件: ${this.cachePath}`);
      }
    } catch (error) {
      this.logger.warn(
        `[CacheStorage] 创建缓存文件失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 加载缓存数据
   */
  async load<T = MCPToolsCache>(): Promise<T> {
    try {
      if (!existsSync(this.cachePath)) {
        return (await this.createInitialCache()) as T;
      }

      const cacheData = readFileSync(this.cachePath, "utf8");
      const cache: unknown = JSON.parse(cacheData);

      // 验证缓存结构
      if (!this.validateCacheStructure(cache)) {
        this.logger.warn("[CacheStorage] 缓存文件结构无效，重新创建");
        return (await this.createInitialCache()) as T;
      }

      return cache as T;
    } catch (error) {
      this.logger.warn(
        `[CacheStorage] 加载缓存失败，创建新缓存: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return (await this.createInitialCache()) as T;
    }
  }

  /**
   * 保存缓存数据
   */
  async save<T = MCPToolsCache>(cache: T): Promise<void> {
    const cacheContent = JSON.stringify(cache, null, 2);
    await this.atomicWrite(cacheContent);
  }

  /**
   * 原子写入文件
   * 使用临时文件确保写入操作的原子性
   */
  private async atomicWrite(data: string): Promise<void> {
    const tempPath = `${this.cachePath}.tmp`;
    try {
      // 写入临时文件
      writeFileSync(tempPath, data, "utf8");
      // 原子性重命名
      renameSync(tempPath, this.cachePath);
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
   * 获取缓存文件路径（用于测试和调试）
   */
  getFilePath(): string {
    return this.cachePath;
  }

  /**
   * 检查缓存文件是否存在
   */
  exists(): boolean {
    return existsSync(this.cachePath);
  }

  /**
   * 获取缓存文件大小
   */
  getFileSize(): number {
    if (!existsSync(this.cachePath)) {
      return 0;
    }
    return readFileSync(this.cachePath, "utf8").length;
  }

  /**
   * 创建初始缓存结构
   */
  private async createInitialCache(): Promise<
    MCPToolsCache & { customMCPResults?: Record<string, unknown> }
  > {
    const now = this.formatTimestamp();
    return {
      version: this.CACHE_VERSION,
      mcpServers: {},
      metadata: {
        lastGlobalUpdate: now,
        totalWrites: 0,
        createdAt: now,
      },
      customMCPResults: {},
    };
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
   * 验证缓存数据结构
   */
  private validateCacheStructure(cache: unknown): cache is MCPToolsCache {
    try {
      if (!cache || typeof cache !== "object") {
        return false;
      }

      const cacheObj = cache as Record<string, unknown>;
      const metadata = cacheObj.metadata as Record<string, unknown>;

      return (
        typeof cacheObj.version === "string" &&
        typeof cacheObj.mcpServers === "object" &&
        cacheObj.mcpServers !== null &&
        cacheObj.metadata !== null &&
        cacheObj.metadata !== undefined &&
        typeof metadata === "object" &&
        metadata !== null &&
        typeof metadata.lastGlobalUpdate === "string" &&
        typeof metadata.totalWrites === "number" &&
        typeof metadata.createdAt === "string"
      );
    } catch {
      return false;
    }
  }
}
