/**
 * 端点管理 API 客户端
 * 负责所有 MCP 端点相关的操作
 */

import { type ApiResponse, HttpClient } from "./http-client";

/**
 * 接入点状态响应接口
 */
export interface EndpointStatusResponse {
  endpoint: string;
  connected: boolean;
  initialized: boolean;
  isReconnecting: boolean;
  reconnectAttempts: number;
  nextReconnectTime?: number;
  reconnectDelay: number;
}

/**
 * 端点管理 API 客户端
 */
export class EndpointApiClient extends HttpClient {
  /**
   * 获取接入点状态
   */
  async getEndpointStatus(endpoint: string): Promise<EndpointStatusResponse> {
    const response: ApiResponse<EndpointStatusResponse> = await this.request(
      "/api/endpoint/status",
      {
        method: "POST",
        body: JSON.stringify({ endpoint }),
      }
    );
    if (!response.success || !response.data) {
      throw new Error("获取接入点状态失败");
    }
    return response.data;
  }

  /**
   * 连接接入点
   */
  async connectEndpoint(endpoint: string): Promise<void> {
    const response: ApiResponse = await this.request("/api/endpoint/connect", {
      method: "POST",
      body: JSON.stringify({ endpoint }),
    });
    if (!response.success) {
      throw new Error(response.error?.message || "连接接入点失败");
    }
  }

  /**
   * 断开接入点
   */
  async disconnectEndpoint(endpoint: string): Promise<void> {
    const response: ApiResponse = await this.request(
      "/api/endpoint/disconnect",
      { method: "POST", body: JSON.stringify({ endpoint }) }
    );
    if (!response.success) {
      throw new Error(response.error?.message || "断开接入点失败");
    }
  }

  /**
   * 重连接入点
   */
  async reconnectEndpoint(endpoint: string): Promise<void> {
    const response: ApiResponse = await this.request(
      "/api/endpoint/reconnect",
      { method: "POST", body: JSON.stringify({ endpoint }) }
    );
    if (!response.success) {
      throw new Error(response.error?.message || "重连接入点失败");
    }
  }

  /**
   * 添加新接入点
   */
  async addEndpoint(endpoint: string): Promise<EndpointStatusResponse> {
    const response: ApiResponse<EndpointStatusResponse> = await this.request(
      "/api/endpoint/add",
      {
        method: "POST",
        body: JSON.stringify({ endpoint }),
      }
    );
    if (!response.success || !response.data) {
      throw new Error(response.error?.message || "添加接入点失败");
    }
    return response.data;
  }

  /**
   * 移除接入点
   */
  async removeEndpoint(endpoint: string): Promise<void> {
    const response: ApiResponse = await this.request("/api/endpoint/remove", {
      method: "POST",
      body: JSON.stringify({ endpoint }),
    });
    if (!response.success) {
      throw new Error(response.error?.message || "移除接入点失败");
    }
  }
}
