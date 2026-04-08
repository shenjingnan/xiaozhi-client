/**
 * HTTP 客户端基类
 * 为所有 API 客户端提供统一的 HTTP 请求方法
 */

import type { ApiErrorResponse } from "@xiaozhi-client/shared-types";

/**
 * API 响应格式
 */
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * HTTP 客户端基类
 */
export class HttpClient {
  protected baseUrl: string;

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
  protected async request<T>(
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
}

// 导出 API 响应格式供其他客户端使用
export type { ApiResponse };
