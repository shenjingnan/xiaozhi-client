/**
 * 扣子 API 服务类
 * 负责与扣子 API 的交互，包括工作空间和工作流的获取
 */

import type { WorkSpace } from "@/lib/coze";
import { CozeAPI, config } from "@/lib/coze";
import type {
  CacheItem,
  CozeWorkflowsData,
  CozeWorkflowsParams,
  CozeWorkflowsResponse,
} from "@root/types/coze";
import { logger } from "../Logger";

/**
 * 缓存管理类
 */
class CozeApiCache {
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

/**
 * 扣子 API 服务类
 */
export class CozeApiService {
  private cache = new CozeApiCache();
  private token: string;
  private client: CozeAPI;

  constructor(token: string) {
    if (!token || typeof token !== "string" || token.trim() === "") {
      throw new Error("扣子 API Token 不能为空");
    }
    this.token = token.trim();

    this.client = new CozeAPI({
      baseURL: config.zh.COZE_BASE_URL,
      token: this.token,
      baseWsURL: config.zh.COZE_BASE_WS_URL,
      debug: false,
    });
  }

  /**
   * 获取工作空间列表
   */
  async getWorkspaces(): Promise<WorkSpace[]> {
    const cacheKey = "workspaces";
    const cached = this.cache.get<WorkSpace[]>(cacheKey);
    if (cached) return cached;

    const { workspaces = [] } = await this.client.workspaces.list();

    this.cache.set(cacheKey, workspaces, "workspaces");

    return workspaces;
  }

  /**
   * 获取工作流列表
   */
  async getWorkflows(params: CozeWorkflowsParams): Promise<CozeWorkflowsData> {
    const { workspace_id, page_num = 1, page_size = 20 } = params;

    if (!workspace_id || typeof workspace_id !== "string") {
      throw new Error("工作空间ID不能为空");
    }

    const cacheKey = `workflows:${workspace_id}:${page_num}:${page_size}`;
    const cached = this.cache.get<CozeWorkflowsData>(cacheKey);
    if (cached) return cached;

    const response = await this.client.get<
      CozeWorkflowsParams,
      CozeWorkflowsResponse
    >("/v1/workflows", {
      workspace_id,
      page_num: page_num,
      page_size: page_size,
      workflow_mode: "workflow",
    });

    const result = response.data;

    this.cache.set(cacheKey, result, "workflows");

    return result;
  }

  /**
   * 清除缓存
   */
  clearCache(pattern?: string): void {
    this.cache.clear(pattern);
    logger.info(`清除扣子 API 缓存${pattern ? ` (模式: ${pattern})` : ""}`);
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): { size: number; keys: string[] } {
    return this.cache.getStats();
  }
}
