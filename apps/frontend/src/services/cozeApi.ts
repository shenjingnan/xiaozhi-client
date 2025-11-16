/**
 * 扣子 API 前端包装器
 * 负责与后端扣子 API 的通信
 */

import type {
  CozeWorkflowsParams,
  CozeWorkflowsResult,
  CozeWorkspace,
} from "@xiaozhi/shared-types";

/**
 * API 响应格式
 */
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * 缓存统计信息
 */
interface CacheStats {
  size: number;
  keys: string[];
}

/**
 * 扣子 API 客户端类
 */
export class CozeApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    // 从当前页面 URL 推断 API 基础 URL
    if (baseUrl) {
      this.baseUrl = baseUrl;
    } else {
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      const port = window.location.port;
      this.baseUrl = `${protocol}//${hostname}${port ? `:${port}` : ""}`;
    }
  }

  /**
   * 通用请求方法
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const defaultOptions: RequestInit = {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    };

    const response = await fetch(url, { ...defaultOptions, ...options });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      try {
        const errorData: ApiErrorResponse = await response.json();
        errorMessage = errorData.error?.message || errorMessage;
      } catch {
        // 如果无法解析错误响应，使用默认错误消息
      }

      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * 获取工作空间列表
   */
  async fetchWorkspaces(): Promise<{ workspaces: CozeWorkspace[] }> {
    try {
      const response: ApiResponse<{ workspaces: CozeWorkspace[] }> =
        await this.request("/api/coze/workspaces");

      if (!response.success || !response.data) {
        throw new Error(response.message || "获取工作空间列表失败");
      }

      return response.data;
    } catch (error) {
      console.error("获取工作空间列表失败:", error);
      throw error;
    }
  }

  /**
   * 获取工作流列表
   */
  async fetchWorkflows(
    params: CozeWorkflowsParams
  ): Promise<CozeWorkflowsResult> {
    try {
      const searchParams = new URLSearchParams();
      searchParams.append("workspace_id", params.workspace_id);

      if (params.page_num !== undefined) {
        searchParams.append("page_num", params.page_num.toString());
      }

      if (params.page_size !== undefined) {
        searchParams.append("page_size", params.page_size.toString());
      }

      const response: ApiResponse<CozeWorkflowsResult> = await this.request(
        `/api/coze/workflows?${searchParams.toString()}`
      );

      if (!response.success || !response.data) {
        throw new Error(response.message || "获取工作流列表失败");
      }

      return response.data;
    } catch (error) {
      console.error("获取工作流列表失败:", error);
      throw error;
    }
  }

  /**
   * 清除缓存
   */
  async clearCache(): Promise<void> {
    try {
      const response: ApiResponse = await this.request(
        "/api/coze/cache/clear",
        {
          method: "POST",
        }
      );

      if (!response.success) {
        throw new Error(response.message || "清除缓存失败");
      }
    } catch (error) {
      console.error("清除缓存失败:", error);
      throw error;
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStats(): Promise<CacheStats> {
    try {
      const response: ApiResponse<CacheStats> = await this.request(
        "/api/coze/cache/stats"
      );

      if (!response.success || !response.data) {
        throw new Error(response.message || "获取缓存统计失败");
      }

      return response.data;
    } catch (error) {
      console.error("获取缓存统计失败:", error);
      throw error;
    }
  }
}

// 创建默认的扣子 API 客户端实例
export const cozeApiClient = new CozeApiClient();

// 导出类型
export type { ApiResponse, ApiErrorResponse, CacheStats };
