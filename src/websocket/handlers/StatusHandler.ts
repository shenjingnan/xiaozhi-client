/**
 * 状态相关 WebSocket 消息处理器
 * 处理状态获取、更新和广播相关的 WebSocket 消息
 */

import type { WebSocket } from "ws";
import { logger } from "../../Logger.js";
import { configManager } from "../../configManager.js";
import type { MessageHandler } from "../../types/WebServerTypes.js";
import { WebSocketMessageType } from "../types.js";

/**
 * 客户端信息接口
 * 从 WebServer.ts 迁移的接口定义
 */
export interface ClientInfo {
  status: "connected" | "disconnected";
  mcpEndpoint: string;
  activeMCPServers: string[];
  lastHeartbeat?: number;
}

/**
 * 状态消息处理器
 * 负责处理状态相关的 WebSocket 消息
 */
export class StatusHandler implements MessageHandler {
  private clientInfo: ClientInfo = {
    status: "disconnected",
    mcpEndpoint: "",
    activeMCPServers: [],
  };

  private broadcastCallback?: (message: any) => void;
  private heartbeatTimeout?: NodeJS.Timeout;
  private readonly HEARTBEAT_TIMEOUT = 30000; // 30秒心跳超时

  /**
   * 判断是否可以处理指定类型的消息
   * @param messageType 消息类型
   * @returns 是否可以处理
   */
  canHandle(messageType: string): boolean {
    return [
      WebSocketMessageType.GET_STATUS,
      WebSocketMessageType.CLIENT_STATUS,
    ].includes(messageType as WebSocketMessageType);
  }

  /**
   * 处理 WebSocket 消息
   * @param ws WebSocket 连接实例
   * @param message 消息对象
   */
  async handle(ws: WebSocket, message: any): Promise<void> {
    try {
      switch (message.type) {
        case WebSocketMessageType.GET_STATUS:
          await this.handleGetStatus(ws);
          break;

        case WebSocketMessageType.CLIENT_STATUS:
          await this.handleClientStatus(ws, message);
          break;

        default:
          logger.warn(`StatusHandler: 未知消息类型 ${message.type}`);
          this.sendError(ws, `未知消息类型: ${message.type}`);
      }
    } catch (error) {
      logger.error("StatusHandler: 消息处理错误:", error);
      this.sendError(
        ws,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * 处理获取状态消息
   * @param ws WebSocket 连接实例
   */
  private async handleGetStatus(ws: WebSocket): Promise<void> {
    try {
      ws.send(
        JSON.stringify({
          type: "status",
          data: this.clientInfo,
        })
      );

      logger.debug("状态信息已发送:", this.clientInfo);
    } catch (error) {
      logger.error("获取状态失败:", error);
      this.sendError(ws, "获取状态失败");
    }
  }

  /**
   * 处理客户端状态消息
   * @param ws WebSocket 连接实例
   * @param message 消息对象
   */
  private async handleClientStatus(ws: WebSocket, message: any): Promise<void> {
    try {
      if (!message.data || typeof message.data !== "object") {
        this.sendError(ws, "无效的状态数据");
        return;
      }

      // 更新客户端信息
      this.updateClientInfo(message.data);

      // 广播状态更新
      this.broadcastStatusUpdate();

      // 每次客户端状态更新时，也发送最新的配置
      const latestConfig = configManager.getConfig();
      ws.send(
        JSON.stringify({
          type: WebSocketMessageType.CONFIG_UPDATE,
          data: latestConfig,
        })
      );

      logger.debug("客户端状态已更新:", this.clientInfo);
    } catch (error) {
      logger.error("更新客户端状态失败:", error);
      this.sendError(ws, "更新客户端状态失败");
    }
  }

  /**
   * 更新客户端信息
   * 从 WebServer.ts 迁移的方法
   * @param info 部分客户端信息
   */
  private updateClientInfo(info: Partial<ClientInfo>): void {
    this.clientInfo = { ...this.clientInfo, ...info };
    if (info.lastHeartbeat) {
      this.clientInfo.lastHeartbeat = Date.now();
    }

    // Reset heartbeat timeout when receiving client status
    if (info.status === "connected") {
      this.resetHeartbeatTimeout();
    }
  }

  /**
   * 重置心跳超时
   * 从 WebServer.ts 迁移的方法
   */
  private resetHeartbeatTimeout(): void {
    // Clear existing timeout
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
    }

    // Set new timeout
    this.heartbeatTimeout = setTimeout(() => {
      logger.warn("客户端心跳超时，标记为断开连接");
      this.updateClientInfo({ status: "disconnected" });
      this.broadcastStatusUpdate();
    }, this.HEARTBEAT_TIMEOUT);
  }

  /**
   * 广播状态更新
   */
  private broadcastStatusUpdate(): void {
    if (this.broadcastCallback) {
      this.broadcastCallback({
        type: WebSocketMessageType.STATUS_UPDATE,
        data: this.clientInfo,
      });
    }
  }

  /**
   * 发送错误消息
   * @param ws WebSocket 连接实例
   * @param error 错误信息
   */
  private sendError(ws: WebSocket, error: string): void {
    try {
      ws.send(
        JSON.stringify({
          type: WebSocketMessageType.ERROR,
          error,
          timestamp: Date.now(),
        })
      );
    } catch (sendError) {
      logger.error("发送错误消息失败:", sendError);
    }
  }

  /**
   * 设置广播回调函数
   * @param callback 广播回调函数
   */
  setBroadcastCallback(callback: (message: any) => void): void {
    this.broadcastCallback = callback;
  }

  /**
   * 获取当前客户端信息
   * @returns 客户端信息
   */
  getClientInfo(): ClientInfo {
    return { ...this.clientInfo };
  }

  /**
   * 发送初始状态数据
   * @param ws WebSocket 连接实例
   */
  async sendInitialStatus(ws: WebSocket): Promise<void> {
    try {
      ws.send(JSON.stringify({ type: "status", data: this.clientInfo }));
    } catch (error) {
      logger.error("发送初始状态数据失败:", error);
    }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = undefined;
    }
  }

  /**
   * 设置客户端为连接状态
   * @param endpoint MCP 端点
   * @param servers 活跃的 MCP 服务器列表
   */
  setClientConnected(endpoint: string, servers: string[] = []): void {
    this.updateClientInfo({
      status: "connected",
      mcpEndpoint: endpoint,
      activeMCPServers: servers,
      lastHeartbeat: Date.now(),
    });
  }

  /**
   * 设置客户端为断开连接状态
   */
  setClientDisconnected(): void {
    this.updateClientInfo({
      status: "disconnected",
    });
  }

  /**
   * 重置客户端状态为断开连接
   */
  resetClientStatus(): void {
    this.updateClientInfo({
      status: "disconnected",
      lastHeartbeat: undefined,
    });
  }
}
