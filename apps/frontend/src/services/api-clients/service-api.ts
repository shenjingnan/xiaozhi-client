/**
 * 服务控制 API 客户端
 * 负责所有服务启动、停止、重启和状态查询操作
 */

import { type ApiResponse, HttpClient } from "./http-client";

/**
 * 服务状态接口
 */
export interface ServiceStatus {
  running: boolean;
  mode?: string;
  pid?: number;
}

/**
 * 服务健康状态接口
 */
export interface ServiceHealth {
  status: string;
  timestamp: number;
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  version: string;
}

/**
 * 服务控制 API 客户端
 */
export class ServiceControlApiClient extends HttpClient {
  /**
   * 重启服务
   */
  async restartService(): Promise<void> {
    const response: ApiResponse = await this.request("/api/services/restart", {
      method: "POST",
    });

    if (!response.success) {
      throw new Error(response.error?.message || "重启服务失败");
    }
  }

  /**
   * 停止服务
   */
  async stopService(): Promise<void> {
    const response: ApiResponse = await this.request("/api/services/stop", {
      method: "POST",
    });

    if (!response.success) {
      throw new Error(response.error?.message || "停止服务失败");
    }
  }

  /**
   * 启动服务
   */
  async startService(): Promise<void> {
    const response: ApiResponse = await this.request("/api/services/start", {
      method: "POST",
    });

    if (!response.success) {
      throw new Error(response.error?.message || "启动服务失败");
    }
  }

  /**
   * 获取服务状态
   */
  async getServiceStatus(): Promise<ServiceStatus> {
    const response: ApiResponse<ServiceStatus> = await this.request(
      "/api/services/status"
    );
    if (!response.success || !response.data) {
      throw new Error("获取服务状态失败");
    }
    return response.data;
  }

  /**
   * 获取服务健康状态
   */
  async getServiceHealth(): Promise<ServiceHealth> {
    const response: ApiResponse<ServiceHealth> = await this.request(
      "/api/services/health"
    );
    if (!response.success || !response.data) {
      throw new Error("获取服务健康状态失败");
    }
    return response.data;
  }
}
