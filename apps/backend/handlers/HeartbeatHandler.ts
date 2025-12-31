import type { Logger } from "@root/Logger.js";
import { logger } from "@root/Logger.js";
import type { NotificationService } from "@services/NotificationService.js";
import type { StatusService } from "@services/StatusService.js";
import { configManager } from "@xiaozhi-client/config";

/**
 * 心跳消息接口
 */
interface HeartbeatMessage {
  type: "clientStatus";
  data: {
    status?: "connected" | "disconnected";
    mcpEndpoint?: string;
    activeMCPServers?: string[];
    timestamp?: number;
  };
}

/**
 * 心跳处理器
 */
export class HeartbeatHandler {
  private logger: Logger;
  private statusService: StatusService;
  private notificationService: NotificationService;

  constructor(
    statusService: StatusService,
    notificationService: NotificationService
  ) {
    this.logger = logger;
    this.statusService = statusService;
    this.notificationService = notificationService;
  }

  /**
   * 处理客户端状态更新（心跳）
   */
  async handleClientStatus(
    ws: any,
    message: HeartbeatMessage,
    clientId: string
  ): Promise<void> {
    try {
      this.logger.debug(`处理客户端状态更新: ${clientId}`, message.data);

      // 更新客户端信息
      const statusUpdate = {
        ...message.data,
        lastHeartbeat: Date.now(),
      };

      this.statusService.updateClientInfo(
        statusUpdate,
        `websocket-${clientId}`
      );

      // 发送最新配置给客户端（心跳响应）
      await this.sendLatestConfig(ws, clientId);

      this.logger.debug(`客户端状态更新成功: ${clientId}`);
    } catch (error) {
      this.logger.error(`处理客户端状态更新失败: ${clientId}`, error);
      this.sendError(
        ws,
        "CLIENT_STATUS_ERROR",
        error instanceof Error ? error.message : "客户端状态更新失败"
      );
    }
  }

  /**
   * 发送最新配置给客户端
   */
  private async sendLatestConfig(ws: any, clientId: string): Promise<void> {
    try {
      const latestConfig = configManager.getConfig();
      const message = {
        type: "configUpdate",
        data: latestConfig,
        timestamp: Date.now(),
      };

      ws.send(JSON.stringify(message));
      this.logger.debug(`最新配置已发送给客户端: ${clientId}`);
    } catch (error) {
      this.logger.error(`发送最新配置失败: ${clientId}`, error);
      // 不抛出错误，避免影响心跳处理
    }
  }

  /**
   * 发送错误消息
   */
  private sendError(ws: any, code: string, message: string): void {
    try {
      const errorResponse = {
        type: "error",
        error: {
          code,
          message,
          timestamp: Date.now(),
        },
      };
      ws.send(JSON.stringify(errorResponse));
    } catch (error) {
      this.logger.error("发送错误消息失败:", error);
    }
  }

  /**
   * 检查客户端心跳超时
   */
  checkHeartbeatTimeout(): void {
    const lastHeartbeat = this.statusService.getLastHeartbeat();
    const now = Date.now();
    const HEARTBEAT_TIMEOUT = 35000; // 35 seconds

    if (lastHeartbeat && now - lastHeartbeat > HEARTBEAT_TIMEOUT) {
      this.logger.warn("客户端心跳超时，标记为断开连接");
      this.statusService.updateClientInfo(
        { status: "disconnected" },
        "heartbeat-timeout"
      );
    }
  }

  /**
   * 启动心跳监控
   */
  startHeartbeatMonitoring(): NodeJS.Timeout {
    const MONITOR_INTERVAL = 10000; // 10 seconds

    this.logger.debug("启动心跳监控");

    return setInterval(() => {
      this.checkHeartbeatTimeout();
      this.cleanupDisconnectedClients();
    }, MONITOR_INTERVAL);
  }

  /**
   * 清理断开连接的客户端
   */
  private cleanupDisconnectedClients(): void {
    try {
      this.notificationService.cleanupDisconnectedClients();
    } catch (error) {
      this.logger.error("清理断开连接的客户端失败:", error);
    }
  }

  /**
   * 停止心跳监控
   */
  stopHeartbeatMonitoring(intervalId: NodeJS.Timeout): void {
    this.logger.info("停止心跳监控");
    clearInterval(intervalId);
  }

  /**
   * 获取心跳统计信息
   */
  getHeartbeatStats(): {
    lastHeartbeat?: number;
    isConnected: boolean;
    clientStats: {
      totalClients: number;
      connectedClients: number;
      queuedMessages: number;
    };
  } {
    return {
      lastHeartbeat: this.statusService.getLastHeartbeat(),
      isConnected: this.statusService.isClientConnected(),
      clientStats: this.notificationService.getClientStats(),
    };
  }

  /**
   * 处理客户端连接建立
   */
  handleClientConnect(clientId: string): void {
    this.logger.info(`客户端连接建立: ${clientId}`);

    // 更新状态为连接
    this.statusService.updateClientInfo(
      {
        status: "connected",
        lastHeartbeat: Date.now(),
      },
      `websocket-connect-${clientId}`
    );
  }

  /**
   * 处理客户端连接断开
   */
  handleClientDisconnect(clientId: string): void {
    this.logger.info(`客户端连接断开: ${clientId}`);

    // 更新状态为断开连接
    this.statusService.updateClientInfo(
      { status: "disconnected" },
      `websocket-disconnect-${clientId}`
    );
  }

  /**
   * 发送心跳响应
   */
  sendHeartbeatResponse(ws: any, clientId: string): void {
    try {
      const response = {
        type: "heartbeatResponse",
        data: {
          timestamp: Date.now(),
          status: "ok",
        },
      };

      ws.send(JSON.stringify(response));
      this.logger.debug(`心跳响应已发送: ${clientId}`);
    } catch (error) {
      this.logger.error(`发送心跳响应失败: ${clientId}`, error);
    }
  }

  /**
   * 验证心跳消息格式
   */
  validateHeartbeatMessage(message: any): message is HeartbeatMessage {
    return (
      message &&
      typeof message === "object" &&
      message.type === "clientStatus" &&
      message.data &&
      typeof message.data === "object"
    );
  }
}
