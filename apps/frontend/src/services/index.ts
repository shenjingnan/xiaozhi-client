/**
 * 服务模块统一导出
 */

import type { AppConfig } from "@xiaozhi-client/shared-types";
import { apiClient } from "./api";
import {
  type ConnectionState,
  type EventBusEvents,
  type EventListener,
  webSocketManager,
} from "./websocket";

/**
 * 网络服务管理器类
 * 只保留有价值的混合模式方法和 WebSocket 代理方法
 */
export class NetworkService {
  private apiClient = apiClient;
  private webSocketManager = webSocketManager;
  private initialized = false;

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
   * @returns 取消订阅的函数
   */
  onWebSocketEvent<K extends keyof EventBusEvents>(
    event: K,
    listener: EventListener<EventBusEvents[K]>
  ): () => void {
    return this.webSocketManager.subscribe(event, listener);
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

  /**
   * 通过 WebSocket 发送消息
   */
  send(message: import("./websocket").WebSocketMessage): boolean {
    return this.webSocketManager.send(message);
  }

  // ==================== 混合模式方法 (HTTP + WebSocket) ====================

  /**
   * 更新配置并等待 WebSocket 通知 (混合模式)
   */
  async updateConfigWithNotification(
    config: AppConfig,
    timeout = 5000
  ): Promise<void> {
    // 设置 WebSocket 监听器等待配置更新通知
    return new Promise((resolve, reject) => {
      const unsubscribe = this.webSocketManager.subscribe(
        "data:configUpdate",
        () => {
          clearTimeout(timeoutId);
          unsubscribe();
          resolve();
        }
      );

      const timeoutId = setTimeout(() => {
        unsubscribe();
        reject(new Error("等待配置更新通知超时"));
      }, timeout);

      // 通过 HTTP API 更新配置
      this.apiClient.updateConfig(config).catch((error) => {
        clearTimeout(timeoutId);
        unsubscribe?.();
        reject(error);
      });
    });
  }

  /**
   * 重启服务并等待状态通知 (混合模式)
   */
  async restartServiceWithNotification(timeout = 30000): Promise<void> {
    return new Promise((resolve, reject) => {
      const unsubscribe = this.webSocketManager.subscribe(
        "data:restartStatus",
        (status: unknown) => {
          if (typeof status === "object" && status !== null && "status" in status) {
            const statusObj = status as { status: string; error?: string };
            if (statusObj.status === "completed") {
              clearTimeout(timeoutId);
              unsubscribe();
              resolve();
            } else if (statusObj.status === "failed") {
              clearTimeout(timeoutId);
              unsubscribe();
              reject(new Error(statusObj.error || "服务重启失败"));
            }
          }
        }
      );

      const timeoutId = setTimeout(() => {
        unsubscribe();
        reject(new Error("等待重启状态通知超时"));
      }, timeout);

      // 通过 HTTP API 重启服务
      this.apiClient.restartService().catch((error) => {
        clearTimeout(timeoutId);
        unsubscribe?.();
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
export { cozeApiClient, CozeApiClient } from "./cozeApi";

// 导出类型
export type { ApiClient } from "./api";
export type { WebSocketManager } from "./websocket";
