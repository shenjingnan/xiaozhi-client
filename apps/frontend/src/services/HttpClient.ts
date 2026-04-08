/**
 * 统一的 HTTP 客户端基类
 * 提供所有前端 API 客户端的通用 HTTP 请求功能
 */

import type { ApiErrorResponse } from "@xiaozhi-client/shared-types";

/**
 * HTTP 客户端配置选项
 */
interface HttpClientOptions {
  /** 基础 URL，默认从当前页面推断 */
  baseUrl?: string;
  /** 默认请求超时时间（毫秒），默认 30000 */
  timeout?: number;
  /** 默认请求头 */
  headers?: Record<string, string>;
}

/**
 * 统一的 HTTP 客户端基类
 * 提供通用请求方法，子类可继承此基类以复用 HTTP 请求逻辑
 */
export class HttpClient {
  protected baseUrl: string;
  protected defaultTimeout: number;
  protected defaultHeaders: Record<string, string>;

  constructor(options: HttpClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? this.inferBaseUrl();
    this.defaultTimeout = options.timeout ?? 30000;
    this.defaultHeaders = {
      "Content-Type": "application/json",
      ...options.headers,
    };
  }

  /**
   * 从当前页面 URL 推断基础 URL
   */
  protected inferBaseUrl(): string {
    if (typeof window === "undefined") {
      return "";
    }
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const port = window.location.port;
    return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
  }

  /**
   * 通用请求方法
   * @param endpoint API 端点路径
   * @param options fetch 请求选项
   * @returns 解析后的 JSON 响应
   */
  protected async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.defaultHeaders,
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw this.handleRequestError(error);
    }
  }

  /**
   * 处理错误响应
   * @param response 非 ok 的 fetch Response 对象
   * @throws 包含错误信息的 Error
   */
  protected async handleErrorResponse(response: Response): Promise<never> {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

    try {
      const errorData: ApiErrorResponse = await response.json();
      errorMessage = errorData.error?.message || errorMessage;
    } catch {
      // 使用默认错误消息
    }

    throw new Error(errorMessage);
  }

  /**
   * 处理请求错误
   * @param error 捕获的错误对象
   * @returns 格式化的 Error 对象
   */
  protected handleRequestError(error: unknown): Error {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return new Error("请求超时");
      }
      return error;
    }
    return new Error(String(error));
  }

  /**
   * 设置基础 URL
   * @param baseUrl 新的基础 URL
   */
  public setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl;
  }

  /**
   * 获取基础 URL
   * @returns 当前基础 URL
   */
  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * 设置默认超时时间
   * @param timeout 超时时间（毫秒）
   */
  public setTimeout(timeout: number): void {
    this.defaultTimeout = timeout;
  }

  /**
   * 获取默认超时时间
   * @returns 当前超时时间（毫秒）
   */
  public getTimeout(): number {
    return this.defaultTimeout;
  }
}
