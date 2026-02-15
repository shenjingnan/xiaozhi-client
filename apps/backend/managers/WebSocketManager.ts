/**
 * WebSocket 管理器
 *
 * 负责 WebSocket 服务器的创建、连接管理和消息处理，包括：
 * - WebSocket 服务器创建
 * - 客户端连接处理
 * - 消息分发和路由
 * - 客户端断开处理
 * - 错误处理
 *
 * @example
 * ```typescript
 * const manager = new WebSocketManager(logger, notificationHandler, heartbeatHandler);
 * await manager.start(httpServer);
 * ```
 */

import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { Logger } from "@/Logger.js";
import type { RealtimeNotificationHandler } from "../handlers/realtime-notification.handler.js";
import type { HeartbeatHandler } from "../handlers/heartbeat.handler.js";
import type { WebSocket } from "ws";
import { WebSocketServer } from "ws";

/**
 * WebSocket 管理器配置选项
 */
export interface WebSocketManagerOptions {
  /** Logger 实例 */
  logger: Logger;
  /** 实时通知处理器 */
  realtimeNotificationHandler: RealtimeNotificationHandler;
  /** 心跳处理器 */
  heartbeatHandler: HeartbeatHandler;
}

/**
 * WebSocket 管理器
 *
 * 负责 WebSocket 服务器的完整生命周期管理
 */
export class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private heartbeatMonitorInterval?: NodeJS.Timeout;

  constructor(private options: WebSocketManagerOptions) {}

  /**
   * 启动 WebSocket 服务器
   *
   * @param httpServer - HTTP 服务器实例
   */
  async start(httpServer: Server<typeof IncomingMessage, typeof ServerResponse>): Promise<void> {
    this.wss = new WebSocketServer({
      server: httpServer,
    });

    this.setupConnectionHandlers();

    this.options.logger.info("WebSocket 服务器已启动");
  }

  /**
   * 停止 WebSocket 服务器
   */
  stop(): void {
    if (!this.wss) {
      return;
    }

    // 强制断开所有 WebSocket 客户端连接
    for (const client of this.wss.clients) {
      client.terminate();
    }

    // 关闭 WebSocket 服务器
    this.wss.close(() => {
      this.options.logger.debug("WebSocket 服务器已关闭");
    });

    this.wss = null;
  }

  /**
   * 启动心跳监控
   *
   * @returns 心跳监控定时器
   */
  startHeartbeatMonitoring(): NodeJS.Timeout | undefined {
    this.heartbeatMonitorInterval =
      this.options.heartbeatHandler.startHeartbeatMonitoring();
    return this.heartbeatMonitorInterval;
  }

  /**
   * 停止心跳监控
   */
  stopHeartbeatMonitoring(): void {
    if (this.heartbeatMonitorInterval) {
      this.options.heartbeatHandler.stopHeartbeatMonitoring(
        this.heartbeatMonitorInterval
      );
      this.heartbeatMonitorInterval = undefined;
    }
  }

  /**
   * 设置连接处理器
   */
  private setupConnectionHandlers(): void {
    if (!this.wss) return;

    const { logger, realtimeNotificationHandler, heartbeatHandler } = this.options;

    this.wss.on("connection", (ws: WebSocket) => {
      // 生成客户端 ID
      const clientId = `client-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      logger.debug(`WebSocket 客户端已连接: ${clientId}`);
      logger.debug(`当前 WebSocket 连接数: ${this.wss?.clients.size || 0}`);

      // 注册客户端到通知服务
      realtimeNotificationHandler.handleClientConnect(ws, clientId);
      heartbeatHandler.handleClientConnect(clientId);

      // 设置消息处理器
      ws.on("message", async (message) => {
        try {
          const data = JSON.parse(message.toString());

          // 根据消息类型分发到不同的处理器
          if (data.type === "clientStatus") {
            await heartbeatHandler.handleClientStatus(ws, data, clientId);
          } else {
            await realtimeNotificationHandler.handleMessage(ws, data, clientId);
          }
        } catch (error) {
          logger.error("WebSocket message error:", error);
          const errorResponse = {
            type: "error",
            error: {
              code: "MESSAGE_PARSE_ERROR",
              message: error instanceof Error ? error.message : "消息解析失败",
              timestamp: Date.now(),
            },
          };
          ws.send(JSON.stringify(errorResponse));
        }
      });

      // 设置关闭处理器
      ws.on("close", () => {
        logger.debug(`WebSocket 客户端已断开连接: ${clientId}`);
        logger.debug(`剩余 WebSocket 连接数: ${this.wss?.clients.size || 0}`);

        // 处理客户端断开连接
        realtimeNotificationHandler.handleClientDisconnect(clientId);
        heartbeatHandler.handleClientDisconnect(clientId);
      });

      // 设置错误处理器
      ws.on("error", (error) => {
        logger.error(`WebSocket 连接错误 (${clientId}):`, error);
      });

      // 发送初始数据
      realtimeNotificationHandler.sendInitialData(ws, clientId);
    });
  }

  /**
   * 获取当前连接的客户端数量
   */
  getClientCount(): number {
    return this.wss?.clients.size || 0;
  }

  /**
   * 检查 WebSocket 服务器是否正在运行
   */
  isRunning(): boolean {
    return this.wss !== null;
  }

  /**
   * 获取 WebSocket 服务器实例
   */
  getServer(): WebSocketServer | null {
    return this.wss;
  }
}
