/**
 * 状态管理 API 客户端
 * 负责所有状态查询和更新操作
 */

import type { ClientStatus } from "@xiaozhi-client/shared-types";
import { type ApiResponse, HttpClient } from "./http-client";

/**
 * 重启状态接口
 */
export interface RestartStatus {
  status: "restarting" | "completed" | "failed";
  error?: string;
  timestamp: number;
}

/**
 * 完整状态接口
 */
export interface FullStatus {
  client: ClientStatus;
  restart?: RestartStatus;
  timestamp: number;
}

/**
 * 状态管理 API 客户端
 */
export class StatusApiClient extends HttpClient {
  /**
   * 获取完整状态
   */
  async getStatus(): Promise<FullStatus> {
    const response: ApiResponse<FullStatus> = await this.request("/api/status");
    if (!response.success || !response.data) {
      throw new Error("获取状态失败");
    }
    return response.data;
  }

  /**
   * 获取客户端状态
   */
  async getClientStatus(): Promise<ClientStatus> {
    const response: ApiResponse<ClientStatus> =
      await this.request("/api/status/client");
    if (!response.success || !response.data) {
      throw new Error("获取客户端状态失败");
    }
    return response.data;
  }

  /**
   * 获取重启状态
   */
  async getRestartStatus(): Promise<RestartStatus | null> {
    const response: ApiResponse<RestartStatus> = await this.request(
      "/api/status/restart"
    );
    if (!response.success) {
      throw new Error("获取重启状态失败");
    }
    return response.data || null;
  }

  /**
   * 检查客户端是否连接
   */
  async checkClientConnected(): Promise<boolean> {
    const response: ApiResponse<{ connected: boolean }> = await this.request(
      "/api/status/connected"
    );
    if (!response.success || response.data?.connected === undefined) {
      throw new Error("检查客户端连接失败");
    }
    return response.data.connected;
  }

  /**
   * 获取最后心跳时间
   */
  async getLastHeartbeat(): Promise<number | null> {
    const response: ApiResponse<{ lastHeartbeat?: number }> =
      await this.request("/api/status/heartbeat");
    if (!response.success) {
      throw new Error("获取最后心跳时间失败");
    }
    return response.data?.lastHeartbeat || null;
  }

  /**
   * 获取活跃的 MCP 服务器列表
   */
  async getActiveMCPServers(): Promise<string[]> {
    const response: ApiResponse<{ servers: string[] }> = await this.request(
      "/api/status/mcp-servers"
    );
    if (!response.success || !response.data) {
      throw new Error("获取活跃 MCP 服务器失败");
    }
    return response.data.servers;
  }

  /**
   * 更新客户端状态
   */
  async updateClientStatus(status: Partial<ClientStatus>): Promise<void> {
    const response: ApiResponse = await this.request("/api/status/client", {
      method: "PUT",
      body: JSON.stringify(status),
    });

    if (!response.success) {
      throw new Error(response.error?.message || "更新客户端状态失败");
    }
  }

  /**
   * 设置活跃的 MCP 服务器列表
   */
  async setActiveMCPServers(servers: string[]): Promise<void> {
    const response: ApiResponse = await this.request(
      "/api/status/mcp-servers",
      {
        method: "PUT",
        body: JSON.stringify({ servers }),
      }
    );

    if (!response.success) {
      throw new Error(response.error?.message || "设置活跃 MCP 服务器失败");
    }
  }

  /**
   * 重置状态
   */
  async resetStatus(): Promise<void> {
    const response: ApiResponse = await this.request("/api/status/reset", {
      method: "POST",
    });

    if (!response.success) {
      throw new Error(response.error?.message || "重置状态失败");
    }
  }
}
