/**
 * 事件协调器
 *
 * 负责协调和管理事件总线监听器，包括：
 * - 接入点状态变更事件监听
 * - MCP 服务添加事件监听
 * - 端点重连事件处理
 *
 * @example
 * ```typescript
 * const coordinator = new EventCoordinator(eventBus, notificationService, endpointManager, logger);
 * coordinator.setup();
 * ```
 */

import type { Logger } from "@/Logger.js";
import type { EventBus, EventBusEvents } from "../services/index.js";
import type { NotificationService } from "../services/index.js";
import type { EndpointManager } from "@xiaozhi-client/endpoint";

/**
 * 事件协调器配置选项
 */
export interface EventCoordinatorOptions {
  /** 事件总线 */
  eventBus: EventBus;
  /** 通知服务 */
  notificationService: NotificationService;
  /** 端点管理器（可选，可能需要在 WebServer 启动后设置） */
  endpointManager?: EndpointManager;
  /** Logger 实例 */
  logger: Logger;
}

/**
 * 事件协调器
 *
 * 负责协调各种事件监听器，将事件处理逻辑从 WebServer 中分离
 */
export class EventCoordinator {
  private options: EventCoordinatorOptions;

  constructor(options: EventCoordinatorOptions) {
    this.options = options;
  }

  /**
   * 设置端点管理器
   *
   * 用于在 WebServer 启动后设置端点管理器实例
   *
   * @param endpointManager - 端点管理器实例
   */
  setEndpointManager(endpointManager: EndpointManager): void {
    this.options.endpointManager = endpointManager;
  }

  /**
   * 设置所有事件监听器
   */
  setup(): void {
    this.setupEndpointStatusListener();
    this.setupMCPServerAddedListener();
  }

  /**
   * 设置接入点状态变更事件监听
   */
  private setupEndpointStatusListener(): void {
    const { eventBus, notificationService, logger } = this.options;

    eventBus.onEvent(
      "endpoint:status:changed",
      (eventData: EventBusEvents["endpoint:status:changed"]) => {
        // 向所有连接的 WebSocket 客户端广播接入点状态变更事件
        const message = {
          type: "endpoint_status_changed",
          data: {
            endpoint: eventData.endpoint,
            connected: eventData.connected,
            operation: eventData.operation,
            success: eventData.success,
            message: eventData.message,
            timestamp: eventData.timestamp,
          },
        };

        notificationService.broadcast("endpoint_status_changed", message);
        logger.debug(
          `广播接入点状态变更事件: ${eventData.endpoint} - ${eventData.operation}`
        );
      }
    );
  }

  /**
   * 设置 MCP 服务添加事件监听
   *
   * 当添加新的 MCP 服务后，自动重连接入点以同步服务列表
   */
  private setupMCPServerAddedListener(): void {
    const { eventBus, logger } = this.options;

    // 监听单个服务添加事件
    eventBus.onEvent(
      "mcp:server:added",
      async (eventData: EventBusEvents["mcp:server:added"]) => {
        logger.info(
          `检测到 MCP 服务添加: ${eventData.serverName}，工具数量: ${eventData.tools.length}`
        );

        await this.handleMCPServerAdded(
          "mcp_server_added",
          eventData.serverName,
          eventData.tools.length
        );
      }
    );

    // 监听批量服务添加事件
    eventBus.onEvent(
      "mcp:server:batch_added",
      async (eventData: EventBusEvents["mcp:server:batch_added"]) => {
        logger.info(
          `检测到批量 MCP 服务添加: ${eventData.addedCount} 个成功，${eventData.failedCount} 个失败`
        );

        if (eventData.addedCount === 0) {
          return;
        }

        await this.handleMCPServerAdded(
          "mcp_server_batch_added",
          undefined,
          eventData.addedCount
        );
      }
    );
  }

  /**
   * 处理 MCP 服务添加后的端点重连
   *
   * @param trigger - 触发类型
   * @param serverName - 服务器名称
   * @param toolCount - 工具数量
   */
  private async handleMCPServerAdded(
    trigger: "mcp_server_added" | "mcp_server_batch_added",
    serverName: string | undefined,
    toolCount: number
  ): Promise<void> {
    const { endpointManager, eventBus, logger } = this.options;

    if (!endpointManager) {
      logger.warn("EndpointManager 未初始化，跳过重连");
      return;
    }

    try {
      // 获取当前连接的端点数量
      const connectionStatuses = endpointManager.getConnectionStatus();
      const connectedEndpointCount = connectionStatuses.filter(
        (status) => status.connected
      ).length;

      if (connectedEndpointCount === 0) {
        logger.debug("当前没有已连接的端点，跳过重连");
        return;
      }

      logger.info(`开始重连 ${connectedEndpointCount} 个接入点...`);

      // 重连所有端点
      await endpointManager.reconnect();

      logger.info("接入点重连成功，新服务工具已同步");

      // 发送重连完成事件
      eventBus.emitEvent("endpoint:reconnect:completed", {
        trigger,
        serverName,
        endpointCount: connectedEndpointCount,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error("接入点重连失败:", error);

      // 发送重连失败事件
      eventBus.emitEvent("endpoint:reconnect:failed", {
        trigger,
        serverName,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      });
    }
  }

  /**
   * 清理所有事件监听器
   *
   * 注意：这不会清理事件总线本身，只是移除此协调器设置的监听器
   * 如果需要完全清理，应该调用 destroyEventBus()
   */
  destroy(): void {
    // 由于事件总线的监听器是通过 onEvent 添加的，
    // 实际的清理工作应该在调用者层面通过 destroyEventBus() 完成
    this.options.logger.debug("事件协调器已销毁");
  }
}
