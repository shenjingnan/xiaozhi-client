/**
 * 通知服务
 *
 * 负责管理 WebSocket 客户端连接和消息推送，实现实时通知功能。
 *
 * ## 核心功能
 * - WebSocket 客户端管理：注册、移除、连接状态跟踪
 * - 消息队列：离线消息缓存，重连后自动推送
 * - 事件广播：监听 EventBus 事件并推送给所有连接的客户端
 * - 消息类型：配置更新、状态变更、服务重启、NPM 安装日志等
 *
 * ## 使用方式
 * - 由 WebServer 在初始化阶段创建实例
 * - 当前主要由 WebSocket 相关 handler（如 RealtimeNotificationHandler / HeartbeatHandler）持有并使用
 * - 如需在 HTTP handler 中使用，可通过自定义中间件将其实例注入到 Hono Context
 *
 * ## 注意事项
 * - 消息队列最大容量：100 条/客户端
 * - 客户断开连接时会自动清理资源
 * - 与 EventBus 紧密集成，监听系统事件并广播
 */

import type { Logger } from "@/Logger.js";
import { logger } from "@/Logger.js";
import type { EventBus } from "@/services/event-bus.service.js";
import { getEventBus } from "@/services/event-bus.service.js";
import type { ClientInfo, RestartStatus } from "@/services/status.service.js";
import type { AppConfig } from "@xiaozhi-client/config";
import { configManager } from "@xiaozhi-client/config";

/**
 * WebSocket 类接口
 * 定义了 WebSocket 实例需要具备的基本属性和方法
 */
export interface WebSocketLike {
  readyState: number;
  send(data: string): void;
}

/**
 * WebSocket 客户端接口
 */
export interface WebSocketClient {
  id: string;
  ws: WebSocketLike;
  readyState: number;
  send: (data: string) => void;
}

/**
 * 通知数据类型
 * 定义了通知消息中可能包含的数据类型
 */
export type NotificationData =
  | AppConfig
  | ClientInfo
  | RestartStatus
  | { message: string }
  | { [key: string]: unknown };

/**
 * 通知消息接口
 */
export interface NotificationMessage {
  type: string;
  data?: NotificationData;
  timestamp?: number;
}

/**
 * 通知服务 - 统一的通知管理服务
 */
export class NotificationService {
  private logger: Logger;
  private eventBus: EventBus;
  private clients: Map<string, WebSocketClient> = new Map();
  private messageQueue: Map<string, NotificationMessage[]> = new Map();
  private maxQueueSize = 100;

  constructor() {
    this.logger = logger;
    this.eventBus = getEventBus();
    this.setupEventListeners();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听配置更新事件
    this.eventBus.onEvent("config:updated", (data) => {
      // 获取最新的配置
      const config = configManager.getConfig();
      this.broadcastConfigUpdate(config);
    });

    // 监听状态更新事件
    this.eventBus.onEvent("status:updated", (data) => {
      this.broadcastStatusUpdate(data.status);
    });

    // 监听重启状态事件
    this.eventBus.onEvent("service:restart:started", (data) => {
      this.broadcastRestartStatus("restarting", undefined, data.timestamp);
    });

    this.eventBus.onEvent("service:restart:completed", (data) => {
      this.broadcastRestartStatus("completed", undefined, data.timestamp);
    });

    this.eventBus.onEvent("service:restart:failed", (data) => {
      this.broadcastRestartStatus("failed", data.error.message, data.timestamp);
    });

    // 监听 NPM 安装事件
    this.eventBus.onEvent("npm:install:started", (data) => {
      this.broadcast("npm:install:started", data);
    });

    this.eventBus.onEvent("npm:install:log", (data) => {
      this.broadcast("npm:install:log", data);
    });

    this.eventBus.onEvent("npm:install:completed", (data) => {
      this.broadcast("npm:install:completed", data);
    });

    this.eventBus.onEvent("npm:install:failed", (data) => {
      this.broadcast("npm:install:failed", data);
    });

    // 监听通知广播事件
    this.eventBus.onEvent("notification:broadcast", (data) => {
      if (data.target) {
        this.sendToClient(data.target, data.type, data.data);
      } else {
        this.broadcast(data.type, data.data);
      }
    });
  }

  /**
   * 注册 WebSocket 客户端
   */
  registerClient(clientId: string, ws: WebSocketLike): void {
    try {
      const client: WebSocketClient = {
        id: clientId,
        ws,
        readyState: ws.readyState,
        send: (data: string) => {
          if (ws.readyState === 1) {
            // WebSocket.OPEN
            ws.send(data);
          }
        },
      };

      this.clients.set(clientId, client);
      this.logger.debug(`WebSocket 客户端已注册: ${clientId}`);
      this.logger.debug(`当前客户端数量: ${this.clients.size}`);

      // 发送排队的消息
      this.sendQueuedMessages(clientId);

      // 发射客户端连接事件
      this.eventBus.emitEvent("websocket:client:connected", {
        clientId,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.error(`注册客户端失败: ${clientId}`, error);
      this.eventBus.emitEvent("notification:error", {
        error: error instanceof Error ? error : new Error(String(error)),
        type: "client:register",
      });
    }
  }

  /**
   * 注销 WebSocket 客户端
   */
  unregisterClient(clientId: string): void {
    try {
      if (this.clients.has(clientId)) {
        this.clients.delete(clientId);
        this.messageQueue.delete(clientId);
        this.logger.debug(`WebSocket 客户端已注销: ${clientId}`);
        this.logger.debug(`剩余客户端数量: ${this.clients.size}`);

        // 发射客户端断开事件
        this.eventBus.emitEvent("websocket:client:disconnected", {
          clientId,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      this.logger.error(`注销客户端失败: ${clientId}`, error);
    }
  }

  /**
   * 广播消息给所有客户端
   */
  broadcast(type: string, data?: NotificationData): void {
    const message: NotificationMessage = {
      type,
      data,
      timestamp: Date.now(),
    };

    this.logger.debug(`广播消息: ${type}`, { clientCount: this.clients.size });

    for (const [clientId, client] of this.clients) {
      this.sendMessageToClient(client, message, clientId);
    }
  }

  /**
   * 发送消息给特定客户端
   */
  sendToClient(clientId: string, type: string, data?: NotificationData): void {
    const message: NotificationMessage = {
      type,
      data,
      timestamp: Date.now(),
    };

    const client = this.clients.get(clientId);
    if (client) {
      this.sendMessageToClient(client, message, clientId);
    } else {
      // 客户端不在线，将消息加入队列
      this.queueMessage(clientId, message);
    }
  }

  /**
   * 发送消息给客户端
   */
  private sendMessageToClient(
    client: WebSocketClient,
    message: NotificationMessage,
    clientId: string
  ): void {
    try {
      if (client.ws.readyState === 1) {
        // WebSocket.OPEN
        const messageStr = JSON.stringify(message);
        client.send(messageStr);
        this.logger.debug(`消息已发送给客户端 ${clientId}: ${message.type}`);
      } else {
        // 连接不可用，将消息加入队列
        this.queueMessage(clientId, message);
        this.logger.warn(`客户端 ${clientId} 连接不可用，消息已加入队列`);
      }
    } catch (error) {
      this.logger.error(`发送消息给客户端 ${clientId} 失败:`, error);
      this.queueMessage(clientId, message);
      this.eventBus.emitEvent("notification:error", {
        error: error instanceof Error ? error : new Error(String(error)),
        type: "message:send",
      });
    }
  }

  /**
   * 将消息加入队列
   */
  private queueMessage(clientId: string, message: NotificationMessage): void {
    if (!this.messageQueue.has(clientId)) {
      this.messageQueue.set(clientId, []);
    }

    const queue = this.messageQueue.get(clientId)!;
    queue.push(message);

    // 限制队列大小
    if (queue.length > this.maxQueueSize) {
      queue.shift(); // 移除最旧的消息
      this.logger.warn(`客户端 ${clientId} 消息队列已满，移除最旧消息`);
    }
  }

  /**
   * 发送排队的消息
   */
  private sendQueuedMessages(clientId: string): void {
    const queue = this.messageQueue.get(clientId);
    if (!queue || queue.length === 0) {
      return;
    }

    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    this.logger.debug(`发送 ${queue.length} 条排队消息给客户端 ${clientId}`);

    for (const message of queue) {
      this.sendMessageToClient(client, message, clientId);
    }

    // 清空队列
    this.messageQueue.delete(clientId);
  }

  /**
   * 广播配置更新
   */
  broadcastConfigUpdate(config: AppConfig): void {
    this.broadcast("configUpdate", config);
  }

  /**
   * 广播状态更新
   */
  broadcastStatusUpdate(status: ClientInfo): void {
    this.broadcast("statusUpdate", status);
  }

  /**
   * 广播重启状态
   */
  broadcastRestartStatus(
    status: "restarting" | "completed" | "failed",
    error?: string,
    timestamp?: number
  ): void {
    const restartStatus: RestartStatus = {
      status,
      error,
      timestamp: timestamp || Date.now(),
    };

    this.broadcast("restartStatus", restartStatus);
  }

  /**
   * 获取客户端统计信息
   */
  getClientStats(): {
    totalClients: number;
    connectedClients: number;
    queuedMessages: number;
  } {
    const connectedClients = Array.from(this.clients.values()).filter(
      (client) => client.ws.readyState === 1
    ).length;

    const queuedMessages = Array.from(this.messageQueue.values()).reduce(
      (total, queue) => total + queue.length,
      0
    );

    return {
      totalClients: this.clients.size,
      connectedClients,
      queuedMessages,
    };
  }

  /**
   * 清理断开的客户端
   */
  cleanupDisconnectedClients(): void {
    const disconnectedClients: string[] = [];

    for (const [clientId, client] of this.clients) {
      if (client.ws.readyState !== 1) {
        // Not WebSocket.OPEN
        disconnectedClients.push(clientId);
      }
    }

    for (const clientId of disconnectedClients) {
      this.unregisterClient(clientId);
    }

    if (disconnectedClients.length > 0) {
      this.logger.debug(`清理了 ${disconnectedClients.length} 个断开的客户端`);
    }
  }

  /**
   * 销毁通知服务
   */
  destroy(): void {
    this.logger.debug("销毁通知服务");
    this.clients.clear();
    this.messageQueue.clear();
  }
}
