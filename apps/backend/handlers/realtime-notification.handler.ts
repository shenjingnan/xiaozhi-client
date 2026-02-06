import type { Logger } from "@/Logger.js";
import { logger } from "@/Logger.js";
import type { EventBus } from "@/services/event-bus.service.js";
import { getEventBus } from "@/services/event-bus.service.js";
import type { NotificationService } from "@/services/notification.service.js";
import type { WebSocketLike } from "@/services/notification.service.js";
import type { StatusService } from "@/services/status.service.js";
import { sendWebSocketError } from "@/utils/websocket-helper.js";
import type { AppConfig } from "@xiaozhi-client/config";
import { configManager } from "@xiaozhi-client/config";

/**
 * WebSocket 消息接口
 */
interface WebSocketMessage {
  type: string;
  data?: any;
  clientId?: string;
}

/**
 * 实时通知处理器
 */
export class RealtimeNotificationHandler {
  private logger: Logger;
  private notificationService: NotificationService;
  private statusService: StatusService;
  private eventBus: EventBus;

  constructor(
    notificationService: NotificationService,
    statusService: StatusService
  ) {
    this.logger = logger;
    this.notificationService = notificationService;
    this.statusService = statusService;
    this.eventBus = getEventBus();
  }

  /**
   * 处理 WebSocket 消息
   * @deprecated 部分消息类型已废弃，建议使用 HTTP API
   */
  async handleMessage(
    ws: WebSocketLike,
    message: WebSocketMessage,
    clientId: string
  ): Promise<void> {
    try {
      this.logger.debug(`处理 WebSocket 消息: ${message.type}`, { clientId });

      // 发射消息接收事件
      this.eventBus.emitEvent("websocket:message:received", {
        type: message.type,
        data: message.data,
        clientId,
      });

      switch (message.type) {
        case "getConfig":
          await this.handleGetConfig(ws, clientId);
          break;

        case "updateConfig":
          await this.handleUpdateConfig(ws, message.data, clientId);
          break;

        case "getStatus":
          await this.handleGetStatus(ws, clientId);
          break;

        case "restartService":
          await this.handleRestartService(ws, clientId);
          break;

        default:
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
    } catch (error) {
      this.logger.error(`处理 WebSocket 消息失败: ${message.type}`, error);
      sendWebSocketError(
        ws,
        "MESSAGE_PROCESSING_ERROR",
        error instanceof Error ? error.message : "消息处理失败",
        this.logger
      );
    }
  }

  /**
   * 处理获取配置请求
   * @deprecated 使用 GET /api/config 替代
   */
  private async handleGetConfig(ws: any, clientId: string): Promise<void> {
    this.logDeprecationWarning("WebSocket getConfig", "GET /api/config");

    try {
      const config = configManager.getConfig();
      this.logger.debug("WebSocket: getConfig 请求处理成功", { clientId });
      ws.send(JSON.stringify({ type: "config", data: config }));
    } catch (error) {
      this.logger.error("WebSocket: getConfig 请求处理失败", error);
      sendWebSocketError(
        ws,
        "CONFIG_READ_ERROR",
        error instanceof Error ? error.message : "获取配置失败",
        this.logger
      );
    }
  }

  /**
   * 处理更新配置请求
   * @deprecated 使用 PUT /api/config 替代
   */
  private async handleUpdateConfig(
    ws: WebSocketLike,
    configData: AppConfig,
    clientId: string
  ): Promise<void> {
    this.logDeprecationWarning("WebSocket updateConfig", "PUT /api/config");

    try {
      // 使用 configManager 的验证方法
      configManager.validateConfig(configData);

      // 使用 configManager 的批量更新方法
      configManager.updateConfig(configData);

      // 更新服务工具配置（单独处理，因为 updateConfig 只更新已存在的配置）
      if (configData.mcpServerConfig) {
        for (const [serverName, toolsConfig] of Object.entries(
          configData.mcpServerConfig
        )) {
          for (const [toolName, toolConfig] of Object.entries(
            toolsConfig.tools
          )) {
            configManager.setToolEnabled(
              serverName,
              toolName,
              toolConfig.enable
            );
          }
        }
      }

      this.logger.debug("WebSocket: 配置更新成功", { clientId });
      ws.send(JSON.stringify({ type: "config:updated", success: true }));
    } catch (error) {
      this.logger.error("WebSocket: 配置更新失败", error);
      sendWebSocketError(
        ws,
        "CONFIG_UPDATE_ERROR",
        error instanceof Error ? error.message : String(error),
        this.logger
      );
    }
  }

  /**
   * 处理获取状态请求
   * @deprecated 使用 GET /api/status 替代
   */
  private async handleGetStatus(ws: any, clientId: string): Promise<void> {
    this.logDeprecationWarning("WebSocket getStatus", "GET /api/status");

    try {
      const status = this.statusService.getFullStatus();
      ws.send(JSON.stringify({ type: "status", data: status.client }));
      this.logger.debug("WebSocket: getStatus 请求处理成功", { clientId });
    } catch (error) {
      this.logger.error("WebSocket: getStatus 请求处理失败", error);
      sendWebSocketError(
        ws,
        "STATUS_READ_ERROR",
        error instanceof Error ? error.message : "获取状态失败",
        this.logger
      );
    }
  }

  /**
   * 处理重启服务请求
   * @deprecated 使用 POST /api/services/restart 替代
   */
  private async handleRestartService(ws: any, clientId: string): Promise<void> {
    this.logDeprecationWarning(
      "WebSocket restartService",
      "POST /api/services/restart"
    );

    try {
      this.logger.info("WebSocket: 收到服务重启请求", { clientId });

      // 发射重启请求事件
      this.eventBus.emitEvent("service:restart:requested", {
        serviceName: "unknown", // 由于是WebSocket触发的，服务名未知
        source: `websocket-${clientId}`,
        delay: 0,
        attempt: 1,
        timestamp: Date.now(),
      });

      // 更新重启状态
      this.statusService.updateRestartStatus("restarting");
    } catch (error) {
      this.logger.error("WebSocket: 处理重启请求失败", error);
      sendWebSocketError(
        ws,
        "RESTART_REQUEST_ERROR",
        error instanceof Error ? error.message : "处理重启请求失败",
        this.logger
      );
    }
  }

  /**
   * 记录废弃功能使用警告
   */
  private logDeprecationWarning(feature: string, alternative: string): void {
    this.logger.warn(
      `[DEPRECATED] ${feature} 功能已废弃，请使用 ${alternative} 替代`
    );
  }

  /**
   * 发送初始数据给新连接的客户端
   */
  async sendInitialData(ws: any, clientId: string): Promise<void> {
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
  handleClientConnect(ws: any, clientId: string): void {
    this.logger.debug(`客户端连接: ${clientId}`);
    this.notificationService.registerClient(clientId, ws);
  }
}
