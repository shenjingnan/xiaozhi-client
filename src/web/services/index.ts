/**
 * 统一的网络服务管理器
 * 整合 HTTP API 客户端
 */

import type { AppConfig, ClientStatus } from "../../types";
import { type ApiClient, apiClient } from "./api";

/**
 * 网络服务管理器类
 */
export class NetworkService {
  private apiClient: ApiClient;
  private initialized = false;

  constructor() {
    this.apiClient = apiClient;
  }

  /**
   * 初始化网络服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log("[NetworkService] 初始化网络服务");
    this.initialized = true;
    console.log("[NetworkService] 网络服务初始化完成");
  }

  /**
   * 销毁网络服务
   */
  destroy(): void {
    console.log("[NetworkService] 销毁网络服务");
    this.initialized = false;
  }

  // ==================== HTTP API 方法 ====================

  /**
   * 获取配置 (HTTP)
   */
  async getConfig(): Promise<AppConfig> {
    return this.apiClient.getConfig();
  }

  /**
   * 更新配置 (HTTP)
   */
  async updateConfig(config: AppConfig): Promise<void> {
    return this.apiClient.updateConfig(config);
  }

  /**
   * 获取状态 (HTTP)
   */
  async getStatus(): Promise<any> {
    return this.apiClient.getStatus();
  }

  /**
   * 获取客户端状态 (HTTP)
   */
  async getClientStatus(): Promise<ClientStatus> {
    return this.apiClient.getClientStatus();
  }

  /**
   * 重启服务 (HTTP)
   */
  async restartService(): Promise<void> {
    return this.apiClient.restartService();
  }

  /**
   * 停止服务 (HTTP)
   */
  async stopService(): Promise<void> {
    return this.apiClient.stopService();
  }

  /**
   * 启动服务 (HTTP)
   */
  async startService(): Promise<void> {
    return this.apiClient.startService();
  }

  /**
   * 获取服务状态 (HTTP)
   */
  async getServiceStatus(): Promise<any> {
    return this.apiClient.getServiceStatus();
  }

  /**
   * 获取服务健康状态 (HTTP)
   */
  async getServiceHealth(): Promise<any> {
    return this.apiClient.getServiceHealth();
  }

  /**
   * 获取 MCP 端点 (HTTP)
   */
  async getMcpEndpoint(): Promise<string> {
    return this.apiClient.getMcpEndpoint();
  }

  /**
   * 获取 MCP 端点列表 (HTTP)
   */
  async getMcpEndpoints(): Promise<string[]> {
    return this.apiClient.getMcpEndpoints();
  }

  /**
   * 获取 MCP 服务配置 (HTTP)
   */
  async getMcpServers(): Promise<Record<string, any>> {
    return this.apiClient.getMcpServers();
  }

  /**
   * 获取连接配置 (HTTP)
   */
  async getConnectionConfig(): Promise<any> {
    return this.apiClient.getConnectionConfig();
  }

  /**
   * 重新加载配置 (HTTP)
   */
  async reloadConfig(): Promise<AppConfig> {
    return this.apiClient.reloadConfig();
  }

  /**
   * 获取配置文件路径 (HTTP)
   */
  async getConfigPath(): Promise<string> {
    return this.apiClient.getConfigPath();
  }

  /**
   * 检查配置是否存在 (HTTP)
   */
  async checkConfigExists(): Promise<boolean> {
    return this.apiClient.checkConfigExists();
  }

  /**
   * 获取重启状态 (HTTP)
   */
  async getRestartStatus(): Promise<any> {
    return this.apiClient.getRestartStatus();
  }

  /**
   * 检查客户端是否连接 (HTTP)
   */
  async checkClientConnected(): Promise<boolean> {
    return this.apiClient.checkClientConnected();
  }

  /**
   * 获取最后心跳时间 (HTTP)
   */
  async getLastHeartbeat(): Promise<number | null> {
    return this.apiClient.getLastHeartbeat();
  }

  /**
   * 获取活跃的 MCP 服务器列表 (HTTP)
   */
  async getActiveMCPServers(): Promise<string[]> {
    return this.apiClient.getActiveMCPServers();
  }

  /**
   * 更新客户端状态 (HTTP)
   */
  async updateClientStatus(status: Partial<ClientStatus>): Promise<void> {
    return this.apiClient.updateClientStatus(status);
  }

  /**
   * 设置活跃的 MCP 服务器列表 (HTTP)
   */
  async setActiveMCPServers(servers: string[]): Promise<void> {
    return this.apiClient.setActiveMCPServers(servers);
  }

  /**
   * 重置状态 (HTTP)
   */
  async resetStatus(): Promise<void> {
    return this.apiClient.resetStatus();
  }

  // ==================== 便捷方法 ====================

  /**
   * 获取完整的应用状态 (HTTP)
   */
  async getFullAppState(): Promise<{
    config: AppConfig;
    status: any;
  }> {
    const [config, status] = await Promise.all([
      this.getConfig(),
      this.getStatus(),
    ]);

    return {
      config,
      status,
    };
  }

  /**
   * 重启服务并等待完成 (轮询模式)
   *
   * 通过 HTTP API 触发重启，然后轮询状态接口等待重启完成。
   */
  async restartServiceWithNotification(timeout = 30000): Promise<void> {
    // 先通过 HTTP API 发送重启请求
    await this.restartService();

    // 轮询等待重启完成
    const startTime = Date.now();
    const pollInterval = 1000; // 1 秒间隔

    while (Date.now() - startTime < timeout) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      try {
        const status = await this.getClientStatus();
        if (status.status === "connected") {
          return; // 重启成功，服务已重新连接
        }
      } catch {
        // 轮询期间服务可能不可用，继续重试
      }
    }

    throw new Error("等待重启完成超时");
  }
}

// 创建默认的网络服务实例
export const networkService = new NetworkService();

// 导出其他服务
export { apiClient };
export { cozeApiClient, CozeApiClient } from "./cozeApi";

// 导出类型
export type { ApiClient };
