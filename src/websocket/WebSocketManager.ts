/**
 * WebSocket 管理器实现
 * 负责管理 WebSocket 连接和消息处理
 */

import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import { logger } from "../Logger.js";
import type {
  IWebSocketManager,
  MessageHandler,
} from "../types/WebServerTypes.js";
import { WebSocketMessageType } from "./types.js";

/**
 * WebSocket 管理器实现类
 */
export class WebSocketManager implements IWebSocketManager {
  private wss: WebSocketServer | null = null;
  private messageHandlers: MessageHandler[] = [];
  private connections: Set<WebSocket> = new Set();

  /**
   * 添加消息处理器
   * @param handler 消息处理器实例
   */
  addMessageHandler(handler: MessageHandler): void {
    if (!handler) {
      throw new Error("消息处理器不能为空");
    }

    this.messageHandlers.push(handler);
    logger.debug(`已添加消息处理器: ${handler.constructor.name}`);
  }

  /**
   * 设置 WebSocket 服务器
   * @param server HTTP 服务器实例
   */
  setup(server: any): void {
    if (!server) {
      throw new Error("HTTP 服务器实例不能为空");
    }

    this.wss = new WebSocketServer({ server });
    this.wss.on("connection", (ws) => this.handleConnection(ws));
    logger.info("WebSocket 服务器设置完成");
  }

  /**
   * 处理新的 WebSocket 连接
   * @param ws WebSocket 连接实例
   */
  handleConnection(ws: WebSocket): void {
    // 添加到连接集合
    this.connections.add(ws);
    logger.debug(`WebSocket 客户端连接，当前连接数: ${this.connections.size}`);

    // 设置消息处理
    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());
        await this.handleMessage(ws, data);
      } catch (error) {
        logger.error("WebSocket 消息处理错误:", error);
        this.sendError(ws, error as Error);
      }
    });

    // 设置连接关闭处理
    ws.on("close", () => {
      this.connections.delete(ws);
      logger.debug(
        `WebSocket 客户端断开连接，当前连接数: ${this.connections.size}`
      );
    });

    // 设置错误处理
    ws.on("error", (error) => {
      logger.error("WebSocket 连接错误:", error);
      this.connections.delete(ws);
    });
  }

  /**
   * 处理 WebSocket 消息
   * @param ws WebSocket 连接实例
   * @param data 消息数据
   */
  private async handleMessage(ws: WebSocket, data: any): Promise<void> {
    if (!data || typeof data.type !== "string") {
      throw new Error("无效的消息格式");
    }

    const handler = this.messageHandlers.find((h) => h.canHandle(data.type));

    if (handler) {
      logger.debug(`处理消息类型: ${data.type}`);
      await handler.handle(ws, data);
    } else {
      logger.warn(`未找到处理器处理消息类型: ${data.type}`);
      this.sendError(ws, new Error(`未知消息类型: ${data.type}`));
    }
  }

  /**
   * 广播消息给所有连接的客户端
   * @param message 要广播的消息
   */
  broadcast(message: any): void {
    if (!message) {
      logger.warn("尝试广播空消息");
      return;
    }

    const messageStr = JSON.stringify(message);
    let sentCount = 0;

    for (const client of this.connections) {
      if (client.readyState === 1) {
        // WebSocket.OPEN
        try {
          client.send(messageStr);
          sentCount++;
        } catch (error) {
          logger.error("广播消息失败:", error);
          this.connections.delete(client);
        }
      }
    }

    logger.debug(`消息已广播给 ${sentCount} 个客户端`);
  }

  /**
   * 发送错误消息给指定客户端
   * @param ws WebSocket 连接实例
   * @param error 错误对象
   */
  private sendError(ws: WebSocket, error: Error): void {
    try {
      ws.send(
        JSON.stringify({
          type: WebSocketMessageType.ERROR,
          error: error.message,
          timestamp: Date.now(),
        })
      );
    } catch (sendError) {
      logger.error("发送错误消息失败:", sendError);
    }
  }

  /**
   * 获取当前连接数
   * @returns 连接数
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * 获取消息处理器数量
   * @returns 处理器数量
   */
  getHandlerCount(): number {
    return this.messageHandlers.length;
  }

  /**
   * 关闭所有连接
   */
  closeAllConnections(): void {
    for (const client of this.connections) {
      try {
        client.close();
      } catch (error) {
        logger.error("关闭连接失败:", error);
      }
    }
    this.connections.clear();
    logger.info("所有 WebSocket 连接已关闭");
  }

  /**
   * 停止 WebSocket 服务器
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.wss) {
        resolve();
        return;
      }

      this.closeAllConnections();

      this.wss.close(() => {
        logger.info("WebSocket 服务器已停止");
        resolve();
      });
    });
  }
}
