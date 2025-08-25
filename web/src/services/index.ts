/**
 * 统一的网络服务管理器
 * 整合 HTTP API 客户端和 WebSocket 管理器
 */

import type { AppConfig, ClientStatus } from "../types";
import { type ApiClient, apiClient } from "./api";
import {
  type ConnectionState,
  type WebSocketManager,
  webSocketManager,
} from "./websocket";

/**
 * 网络服务管理器类
 */
export class NetworkService {
  private apiClient: ApiClient;
  private webSocketManager: WebSocketManager;
  private initialized = false;

  constructor() {
    this.apiClient = apiClient;
    this.webSocketManager = webSocketManager;
  }

  /**
   * 初始化网络服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log("[NetworkService] 初始化网络服务");

    // 启动 WebSocket 连接
    this.webSocketManager.connect();

    this.initialized = true;
    console.log("[NetworkService] 网络服务初始化完成");
  }

  /**
   * 销毁网络服务
   */
  destroy(): void {
    console.log("[NetworkService] 销毁网络服务");
    this.webSocketManager.disconnect();
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

  // ==================== WebSocket 方法 ====================

  /**
   * 获取 WebSocket 连接状态
   */
  getWebSocketState(): ConnectionState {
    return this.webSocketManager.getState();
  }

  /**
   * 检查 WebSocket 是否已连接
   */
  isWebSocketConnected(): boolean {
    return this.webSocketManager.isConnected();
  }

  /**
   * 设置 WebSocket URL
   */
  setWebSocketUrl(url: string): void {
    this.webSocketManager.setUrl(url);
  }

  /**
   * 监听 WebSocket 事件
   */
  onWebSocketEvent<
    K extends keyof import("./websocket").WebSocketEventListeners,
  >(
    event: K,
    listener: import("./websocket").WebSocketEventListeners[K]
  ): void {
    this.webSocketManager.on(event, listener);
  }

  /**
   * 移除 WebSocket 事件监听器
   */
  offWebSocketEvent<
    K extends keyof import("./websocket").WebSocketEventListeners,
  >(event: K): void {
    this.webSocketManager.off(event);
  }

  /**
   * 重新连接 WebSocket
   */
  reconnectWebSocket(): void {
    this.webSocketManager.disconnect();
    setTimeout(() => {
      this.webSocketManager.connect();
    }, 1000);
  }

  // ==================== 便捷方法 ====================

  /**
   * 获取完整的应用状态 (HTTP + WebSocket)
   */
  async getFullAppState(): Promise<{
    config: AppConfig;
    status: any;
    webSocketConnected: boolean;
  }> {
    const [config, status] = await Promise.all([
      this.getConfig(),
      this.getStatus(),
    ]);

    return {
      config,
      status,
      webSocketConnected: this.isWebSocketConnected(),
    };
  }

  /**
   * 更新配置并等待 WebSocket 通知 (混合模式)
   */
  async updateConfigWithNotification(
    config: AppConfig,
    timeout = 5000
  ): Promise<void> {
    // 设置 WebSocket 监听器等待配置更新通知
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.webSocketManager.off("configUpdate");
        reject(new Error("等待配置更新通知超时"));
      }, timeout);

      this.webSocketManager.on("configUpdate", () => {
        clearTimeout(timeoutId);
        this.webSocketManager.off("configUpdate");
        resolve();
      });

      // 通过 HTTP API 更新配置
      this.updateConfig(config).catch((error) => {
        clearTimeout(timeoutId);
        this.webSocketManager.off("configUpdate");
        reject(error);
      });
    });
  }

  /**
   * 重启服务并等待状态通知 (混合模式)
   */
  async restartServiceWithNotification(timeout = 30000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.webSocketManager.off("restartStatus");
        reject(new Error("等待重启状态通知超时"));
      }, timeout);

      this.webSocketManager.on("restartStatus", (status) => {
        if (status.status === "completed") {
          clearTimeout(timeoutId);
          this.webSocketManager.off("restartStatus");
          resolve();
        } else if (status.status === "failed") {
          clearTimeout(timeoutId);
          this.webSocketManager.off("restartStatus");
          reject(new Error(status.error || "服务重启失败"));
        }
      });

      // 通过 HTTP API 重启服务
      this.restartService().catch((error) => {
        clearTimeout(timeoutId);
        this.webSocketManager.off("restartStatus");
        reject(error);
      });
    });
  }
}

// 创建默认的网络服务实例
export const networkService = new NetworkService();

// 导出其他服务
export { apiClient, webSocketManager };
export { ConnectionState } from "./websocket";

// 导出类型
export type { ApiClient, WebSocketManager };
