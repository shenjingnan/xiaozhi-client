import type { Logger } from "@/Logger.js";
import { logger } from "@/Logger.js";
import type { EventBus } from "@/services/event-bus.service.js";
import { getEventBus } from "@/services/event-bus.service.js";

/**
 * 客户端信息接口
 */
export interface ClientInfo {
  status: "connected" | "disconnected";
  mcpEndpoint: string;
  activeMCPServers: string[];
  lastHeartbeat?: number;
}

/**
 * 重启状态接口
 */
export interface RestartStatus {
  status: "restarting" | "completed" | "failed";
  error?: string;
  timestamp: number;
  serviceName?: string;
  attempt?: number;
}

/**
 * 状态服务 - 统一的状态管理服务
 */
export class StatusService {
  private logger: Logger;
  private eventBus: EventBus;
  private clientInfo: ClientInfo = {
    status: "disconnected",
    mcpEndpoint: "",
    activeMCPServers: [],
  };
  private restartStatus?: RestartStatus;
  private heartbeatTimeout?: NodeJS.Timeout;
  private readonly HEARTBEAT_TIMEOUT = 35000; // 35 seconds

  constructor() {
    this.logger = logger;
    this.eventBus = getEventBus();
  }

  /**
   * 获取客户端状态
   */
  getClientStatus(): ClientInfo {
    return { ...this.clientInfo };
  }

  /**
   * 更新客户端信息
   */
  updateClientInfo(info: Partial<ClientInfo>, source = "unknown"): void {
    try {
      const oldStatus = { ...this.clientInfo };
      this.clientInfo = { ...this.clientInfo, ...info };

      if (info.lastHeartbeat) {
        this.clientInfo.lastHeartbeat = Date.now();
      }

      // 接收到客户端状态时重置心跳超时
      if (info.status === "connected") {
        this.resetHeartbeatTimeout();
      }

      this.logger.debug(`客户端状态更新，来源: ${source}`, {
        old: oldStatus,
        new: this.clientInfo,
      });

      // 发射状态更新事件
      this.eventBus.emitEvent("status:updated", {
        status: this.clientInfo,
        source,
      });
    } catch (error) {
      this.logger.error("更新客户端状态失败:", error);
      this.eventBus.emitEvent("status:error", {
        error: error instanceof Error ? error : new Error(String(error)),
        operation: "updateClientInfo",
      });
    }
  }

  /**
   * 获取重启状态
   */
  getRestartStatus(): RestartStatus | undefined {
    return this.restartStatus ? { ...this.restartStatus } : undefined;
  }

  /**
   * 更新重启状态
   */
  updateRestartStatus(
    status: "restarting" | "completed" | "failed",
    error?: string
  ): void {
    try {
      this.restartStatus = {
        status,
        error,
        timestamp: Date.now(),
      };

      this.logger.info(`重启状态更新: ${status}`, { error });

      // 根据状态发射不同的事件
      switch (status) {
        case "restarting":
          this.eventBus.emitEvent("service:restart:started", {
            serviceName: this.restartStatus.serviceName || "",
            attempt: this.restartStatus.attempt || 1,
            timestamp: this.restartStatus.timestamp,
          });
          break;
        case "completed":
          this.eventBus.emitEvent("service:restart:completed", {
            serviceName: this.restartStatus.serviceName || "",
            attempt: this.restartStatus.attempt || 1,
            timestamp: this.restartStatus.timestamp,
          });
          break;
        case "failed":
          this.eventBus.emitEvent("service:restart:failed", {
            serviceName: this.restartStatus.serviceName || "",
            error: new Error(error || "重启失败"),
            attempt: this.restartStatus.attempt || 1,
            timestamp: this.restartStatus.timestamp,
          });
          break;
      }
    } catch (error) {
      this.logger.error("更新重启状态失败:", error);
      this.eventBus.emitEvent("status:error", {
        error: error instanceof Error ? error : new Error(String(error)),
        operation: "updateRestartStatus",
      });
    }
  }

  /**
   * 获取完整状态信息
   */
  getFullStatus(): {
    client: ClientInfo;
    restart?: RestartStatus;
    timestamp: number;
  } {
    return {
      client: this.getClientStatus(),
      restart: this.getRestartStatus(),
      timestamp: Date.now(),
    };
  }

  /**
   * 重置心跳超时
   */
  private resetHeartbeatTimeout(): void {
    // 清除现有的超时定时器
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
    }

    // 设置新的超时定时器
    this.heartbeatTimeout = setTimeout(() => {
      this.logger.debug("客户端心跳超时，标记为断开连接");
      this.updateClientInfo({ status: "disconnected" }, "heartbeat-timeout");
    }, this.HEARTBEAT_TIMEOUT);
  }

  /**
   * 清除心跳超时
   */
  clearHeartbeatTimeout(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = undefined;
    }
  }

  /**
   * 检查客户端是否连接
   */
  isClientConnected(): boolean {
    return this.clientInfo.status === "connected";
  }

  /**
   * 获取最后心跳时间
   */
  getLastHeartbeat(): number | undefined {
    return this.clientInfo.lastHeartbeat;
  }

  /**
   * 获取活跃的 MCP 服务器列表
   */
  getActiveMCPServers(): string[] {
    return [...this.clientInfo.activeMCPServers];
  }

  /**
   * 设置活跃的 MCP 服务器列表
   */
  setActiveMCPServers(servers: string[]): void {
    this.updateClientInfo(
      { activeMCPServers: [...servers] },
      "mcp-servers-update"
    );
  }

  /**
   * 设置 MCP 端点
   */
  setMcpEndpoint(endpoint: string): void {
    this.updateClientInfo({ mcpEndpoint: endpoint }, "mcp-endpoint-update");
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.logger.info("重置状态服务");
    this.clearHeartbeatTimeout();
    this.clientInfo = {
      status: "disconnected",
      mcpEndpoint: "",
      activeMCPServers: [],
    };
    this.restartStatus = undefined;
  }

  /**
   * 销毁状态服务
   */
  destroy(): void {
    this.logger.info("销毁状态服务");
    this.clearHeartbeatTimeout();
    this.reset();
  }
}
