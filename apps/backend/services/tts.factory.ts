/**
 * TTS 客户端工厂
 * 管理 TTS 客户端实例的创建和复用
 */

import { logger } from "@/Logger.js";
import type { ByteDanceTTSConfig } from "@xiaozhi-client/tts";
import { TTS } from "@xiaozhi-client/tts";

/**
 * TTS 配置键
 * 用于标识和缓存 TTS 客户端实例
 */
interface TTSConfigKey {
  appid: string;
  accessToken: string;
  voice_type: string;
  encoding: string;
  cluster?: string;
  endpoint?: string;
}

/**
 * TTS 客户端实例缓存
 */
interface TTSCacheEntry {
  client: TTS;
  config: TTSConfigKey;
  lastUsed: number;
}

/**
 * TTS 工厂选项
 */
interface TTSFactoryOptions {
  /** 是否启用客户端缓存（默认启用） */
  enableCache?: boolean;
  /** 缓存过期时间（毫秒，默认 5 分钟） */
  cacheExpiryMs?: number;
  /** 最大缓存实例数（默认 10） */
  maxCacheSize?: number;
}

/**
 * TTS 客户端工厂
 * 负责创建和管理 TTS 客户端实例
 */
export class TTSFactory {
  /** TTS 客户端缓存 */
  private readonly cache = new Map<string, TTSCacheEntry>();

  /** 工厂配置 */
  private readonly options: Required<TTSFactoryOptions>;

  /** 清理定时器 */
  private cleanupTimer?: NodeJS.Timeout;

  constructor(options: TTSFactoryOptions = {}) {
    this.options = {
      enableCache: options.enableCache ?? true,
      cacheExpiryMs: options.cacheExpiryMs ?? 5 * 60 * 1000, // 5 分钟
      maxCacheSize: options.maxCacheSize ?? 10,
    };

    // 启动缓存清理定时器
    if (this.options.enableCache) {
      this.startCleanupTimer();
    }

    logger.debug("TTS 工厂初始化完成", {
      enableCache: this.options.enableCache,
      cacheExpiryMs: this.options.cacheExpiryMs,
      maxCacheSize: this.options.maxCacheSize,
    });
  }

  /**
   * 获取或创建 TTS 客户端
   * @param config - TTS 配置
   * @returns TTS 客户端实例
   */
  getOrCreateClient(config: TTSConfigKey): TTS {
    // 如果禁用缓存，直接创建新实例
    if (!this.options.enableCache) {
      return this.createClient(config);
    }

    // 生成配置键
    const key = this.generateConfigKey(config);

    // 检查缓存中是否存在
    const cached = this.cache.get(key);
    if (cached) {
      // 更新最后使用时间
      cached.lastUsed = Date.now();
      logger.debug("复用缓存的 TTS 客户端", { key });
      return cached.client;
    }

    // 创建新客户端
    const client = this.createClient(config);

    // 添加到缓存
    this.addToCache(key, client, config);

    logger.debug("创建新的 TTS 客户端", { key });
    return client;
  }

  /**
   * 创建新的 TTS 客户端
   * @param config - TTS 配置
   * @returns TTS 客户端实例
   */
  private createClient(config: TTSConfigKey): TTS {
    const ttsConfig: ByteDanceTTSConfig = {
      app: {
        appid: config.appid,
        accessToken: config.accessToken,
      },
      audio: {
        voice_type: config.voice_type,
        encoding: config.encoding,
      },
      cluster: config.cluster,
      endpoint: config.endpoint,
    };

    return new TTS({
      bytedance: {
        v1: ttsConfig,
      },
    });
  }

  /**
   * 生成配置键
   * @param config - TTS 配置
   * @returns 配置键字符串
   */
  private generateConfigKey(config: TTSConfigKey): string {
    return `${config.appid}:${config.accessToken}:${config.voice_type}:${config.encoding}:${config.cluster || ""}:${config.endpoint || ""}`;
  }

  /**
   * 添加客户端到缓存
   * @param key - 配置键
   * @param client - TTS 客户端
   * @param config - 配置信息
   */
  private addToCache(key: string, client: TTS, config: TTSConfigKey): void {
    // 如果缓存已满，清理最旧的实例
    if (this.cache.size >= this.options.maxCacheSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      client,
      config,
      lastUsed: Date.now(),
    });
  }

  /**
   * 清理最旧的缓存实例
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Number.POSITIVE_INFINITY;

    for (const [key, entry] of this.cache) {
      if (entry.lastUsed < oldestTime) {
        oldestTime = entry.lastUsed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const entry = this.cache.get(oldestKey);
      if (entry) {
        entry.client.close();
        this.cache.delete(oldestKey);
        logger.debug("清理最旧的 TTS 客户端缓存", { key: oldestKey });
      }
    }
  }

  /**
   * 清理过期缓存
   */
  private cleanupExpired(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache) {
      if (now - entry.lastUsed > this.options.cacheExpiryMs) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      const entry = this.cache.get(key);
      if (entry) {
        entry.client.close();
        this.cache.delete(key);
        logger.debug("清理过期 TTS 客户端缓存", { key });
      }
    }
  }

  /**
   * 启动缓存清理定时器
   */
  private startCleanupTimer(): void {
    // 每分钟清理一次过期缓存
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, 60 * 1000);
  }

  /**
   * 停止缓存清理定时器
   */
  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * 清理指定配置的客户端
   * @param config - TTS 配置
   */
  removeClient(config: TTSConfigKey): void {
    const key = this.generateConfigKey(config);
    const entry = this.cache.get(key);
    if (entry) {
      entry.client.close();
      this.cache.delete(key);
      logger.debug("移除 TTS 客户端", { key });
    }
  }

  /**
   * 清理所有缓存
   */
  clearCache(): void {
    for (const entry of this.cache.values()) {
      entry.client.close();
    }
    this.cache.clear();
    logger.debug("清理所有 TTS 客户端缓存");
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    entries: Array<{ key: string; lastUsed: number }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      lastUsed: entry.lastUsed,
    }));

    return {
      size: this.cache.size,
      maxSize: this.options.maxCacheSize,
      entries,
    };
  }

  /**
   * 销毁工厂
   */
  destroy(): void {
    this.stopCleanupTimer();
    this.clearCache();
    logger.debug("TTS 工厂已销毁");
  }
}
