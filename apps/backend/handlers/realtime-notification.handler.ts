/**
 * 实时通知 HTTP 路由处理器
 * 提供 WebSocket 实时通知相关的客户端连接管理和初始数据推送功能
 *
 * 注意：原先通过 WebSocket 处理的 getConfig、updateConfig、getStatus、restartService
 * 等消息类型已废弃，对应功能请使用 RESTful API：
 * - 获取配置：GET /api/config
 * - 更新配置：PUT /api/config
 * - 获取状态：GET /api/status
 * - 重启服务：POST /api/services/restart
 */

import type { Logger } from "@/Logger.js";
import { logger } from "@/Logger.js";
import type {
  NotificationService,
  WebSocketLike,
} from "@/services/notification.service.js";
import type { StatusService } from "@/services/status.service.js";
import { sendWebSocketError } from "@/utils/websocket-helper.js";
import { configManager } from "@xiaozhi-client/config";

/**
 * WebSocket 消息接口
 */
interface WebSocketMessage {
  type: string;
  data?: unknown;
  clientId?: string;
}

/**
 * 实时通知处理器
 *
 * 职责：管理 WebSocket 客户端连接生命周期和初始数据推送。
 * 业务操作（配置读写、状态查询、服务控制）均已迁移至 RESTful API。
 */
export class RealtimeNotificationHandler {
  private logger: Logger;
  private notificationService: NotificationService;
  private statusService: StatusService;

  constructor(
    notificationService: NotificationService,
    statusService: StatusService
  ) {
    this.logger = logger;
    this.notificationService = notificationService;
    this.statusService = statusService;
  }

  /**
   * 处理 WebSocket 消息
   *
   * 当前仅保留心跳消息（clientStatus）由 HeartbeatHandler 处理，
   * 其他业务消息类型已废弃并迁移至 RESTful API。
   */
  async handleMessage(
    ws: WebSocketLike,
    message: WebSocketMessage,
    clientId: string
  ): Promise<void> {
    // 已废弃的消息类型不再处理，返回错误提示引导使用 REST API
    const deprecatedTypes = [
      "getConfig",
      "updateConfig",
      "getStatus",
      "restartService",
    ];

    if (deprecatedTypes.includes(message.type)) {
      this.logger.warn(
        `[DEPRECATED] WebSocket 消息类型 "${message.type}" 已废弃，请使用对应的 RESTful API`,
        { clientId }
      );
      sendWebSocketError(
        ws,
        "DEPRECATED_MESSAGE_TYPE",
        `消息类型 "${message.type}" 已废弃，请使用 RESTful API`,
        this.logger
      );
      return;
    }

    // 未知消息类型
    this.logger.warn(`未知的 WebSocket 消息类型: ${message.type}`, {
      clientId,
    });
    sendWebSocketError(
      ws,
      "UNKNOWN_MESSAGE_TYPE",
      `未知的消息类型: ${message.type}`,
      this.logger
    );
  }

  /**
   * 发送初始数据给新连接的客户端
   */
  async sendInitialData(ws: WebSocketLike, clientId: string): Promise<void> {
    try {
      this.logger.debug("发送初始数据给客户端", { clientId });

      // 发送当前配置
      const config = configManager.getConfig();
      ws.send(JSON.stringify({ type: "configUpdate", data: config }));

      // 发送当前状态
      const status = this.statusService.getFullStatus();
      ws.send(JSON.stringify({ type: "statusUpdate", data: status.client }));

      // 如果有重启状态，也发送
      if (status.restart) {
        ws.send(
          JSON.stringify({ type: "restartStatus", data: status.restart })
        );
      }

      this.logger.debug("初始数据发送完成", { clientId });
    } catch (error) {
      this.logger.error("发送初始数据失败:", error);
      sendWebSocketError(
        ws,
        "INITIAL_DATA_ERROR",
        error instanceof Error ? error.message : "发送初始数据失败",
        this.logger
      );
    }
  }

  /**
   * 处理客户端断开连接
   */
  handleClientDisconnect(clientId: string): void {
    this.logger.debug(`客户端断开连接: ${clientId}`);
    this.notificationService.unregisterClient(clientId);
  }

  /**
   * 处理客户端连接
   */
  handleClientConnect(ws: WebSocketLike, clientId: string): void {
    this.logger.debug(`客户端连接: ${clientId}`);
    this.notificationService.registerClient(clientId, ws);
  }
}
