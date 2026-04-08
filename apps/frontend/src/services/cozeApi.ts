/**
 * 扣子 API 前端包装器
 * 负责与后端扣子 API 的通信
 */

import type {
  CozeWorkflowsParams,
  CozeWorkflowsResult,
  CozeWorkspace,
} from "@xiaozhi-client/shared-types";
import { HttpClient } from "./HttpClient";

/**
 * API 响应格式
 */
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
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
 * 继承自 HttpClient，提供扣子相关的 API 端点方法
 */
export class CozeApiClient extends HttpClient {
  constructor(baseUrl?: string) {
    super({ baseUrl, timeout: 30000 });
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
export type { ApiResponse, CacheStats };
