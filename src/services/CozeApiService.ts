/**
 * 扣子 API 服务类
 * 负责与扣子 API 的交互，包括工作空间和工作流的获取
 */

import { logger } from "../Logger";
import type {
  CacheItem,
  CozeApiError,
  CozeWorkflow,
  CozeWorkflowsParams,
  CozeWorkflowsResponse,
  CozeWorkspace,
  CozeWorkspacesResponse,
} from "../types/coze";

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
 * 扣子 API 错误类
 */
class CozeApiErrorImpl extends Error implements CozeApiError {
  public code: string;
  public statusCode?: number;
  public response?: any;

  constructor(
    message: string,
    code: string,
    statusCode?: number,
    response?: any
  ) {
    super(message);
    this.name = "CozeApiError";
    this.code = code;
    this.statusCode = statusCode;
    this.response = response;
  }
}

/**
 * 指数退避重试函数
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }

      // 指数退避延迟
      const delay = baseDelay * 2 ** (attempt - 1);
      logger.warn(
        `扣子 API 调用失败，${delay}ms 后重试 (${attempt}/${maxAttempts})`,
        error
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Max retry attempts exceeded");
}

/**
 * 处理扣子 API 错误
 */
function handleCozeApiError(
  response: Response,
  responseData?: any
): CozeApiError {
  const statusCode = response.status;

  if (statusCode === 401) {
    return new CozeApiErrorImpl(
      "认证失败，请检查扣子 API Token 配置",
      "AUTH_FAILED",
      401,
      responseData
    );
  }

  if (statusCode === 429) {
    return new CozeApiErrorImpl(
      "请求过于频繁，请稍后重试",
      "RATE_LIMITED",
      429,
      responseData
    );
  }

  if (statusCode >= 500) {
    return new CozeApiErrorImpl(
      "扣子服务器错误，请稍后重试",
      "SERVER_ERROR",
      statusCode,
      responseData
    );
  }

  return new CozeApiErrorImpl(
    responseData?.msg || `API 调用失败: ${response.statusText}`,
    "API_ERROR",
    statusCode,
    responseData
  );
}

/**
 * 扣子 API 服务类
 */
export class CozeApiService {
  private cache = new CozeApiCache();
  private token: string;

  // 使用合理的默认配置，避免配置过度复杂化
  private readonly API_BASE_URL = "https://api.coze.cn";
  private readonly TIMEOUT = 10000;
  private readonly RETRY_ATTEMPTS = 3;

  constructor(token: string) {
    if (!token || typeof token !== "string" || token.trim() === "") {
      throw new Error("扣子 API Token 不能为空");
    }
    this.token = token.trim();
  }

  /**
   * 获取工作空间列表
   */
  async getWorkspaces(): Promise<CozeWorkspace[]> {
    const cacheKey = "workspaces";
    const cached = this.cache.get<CozeWorkspace[]>(cacheKey);
    if (cached) {
      logger.debug("从缓存获取工作空间列表");
      return cached;
    }

    logger.info("获取扣子工作空间列表");

    const response =
      await this.request<CozeWorkspacesResponse>("/v1/workspaces");

    if (response.code !== 0) {
      throw new CozeApiErrorImpl(
        response.msg || "获取工作空间列表失败",
        "API_ERROR",
        undefined,
        response
      );
    }

    const workspaces = response.data.workspaces;
    this.cache.set(cacheKey, workspaces, "workspaces");

    logger.info(`成功获取 ${workspaces.length} 个工作空间`);
    return workspaces;
  }

  /**
   * 获取工作流列表
   */
  async getWorkflows(params: CozeWorkflowsParams): Promise<{
    items: CozeWorkflow[];
    hasMore: boolean;
  }> {
    const { workspace_id, page_num = 1, page_size = 20 } = params;

    if (!workspace_id || typeof workspace_id !== "string") {
      throw new Error("工作空间ID不能为空");
    }

    const cacheKey = `workflows:${workspace_id}:${page_num}:${page_size}`;
    const cached = this.cache.get<{ items: CozeWorkflow[]; hasMore: boolean }>(
      cacheKey
    );
    if (cached) {
      logger.debug(`从缓存获取工作流列表: ${workspace_id}`);
      return cached;
    }

    logger.info(
      `获取工作空间 ${workspace_id} 的工作流列表 (页码: ${page_num}, 每页: ${page_size})`
    );

    const queryParams = new URLSearchParams({
      workspace_id,
      page_num: page_num.toString(),
      page_size: page_size.toString(),
      workflow_mode: "workflow",
    });

    const response = await this.request<CozeWorkflowsResponse>(
      `/v1/workflows?${queryParams}`
    );

    if (response.code !== 0) {
      throw new CozeApiErrorImpl(
        response.msg || "获取工作流列表失败",
        "API_ERROR",
        undefined,
        response
      );
    }

    const result = {
      items: response.data.items,
      hasMore: response.data.has_more,
    };

    this.cache.set(cacheKey, result, "workflows");

    logger.info(
      `成功获取 ${result.items.length} 个工作流，hasMore: ${result.hasMore}`
    );
    return result;
  }

  /**
   * 通用请求方法
   */
  private async request<T>(endpoint: string): Promise<T> {
    return retryWithBackoff(async () => {
      const url = `${this.API_BASE_URL}${endpoint}`;

      logger.debug(`发起扣子 API 请求: ${url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT);

      try {
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        let responseData: any;
        try {
          responseData = await response.json();
        } catch (parseError) {
          logger.error("解析响应 JSON 失败:", parseError);
          throw new CozeApiErrorImpl(
            "响应数据格式错误",
            "PARSE_ERROR",
            response.status
          );
        }

        if (!response.ok) {
          throw handleCozeApiError(response, responseData);
        }

        return responseData;
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof Error && error.name === "AbortError") {
          throw new CozeApiErrorImpl(
            `请求超时 (${this.TIMEOUT}ms)`,
            "TIMEOUT",
            undefined
          );
        }

        throw error;
      }
    }, this.RETRY_ATTEMPTS);
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
