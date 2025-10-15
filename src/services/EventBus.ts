import { EventEmitter } from "node:events";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { type Logger, logger } from "../Logger.js";

/**
 * 事件类型定义
 */
export interface EventBusEvents {
  // 配置相关事件
  "config:updated": {
    type: string;
    serviceName?: string;
    timestamp: Date;
  };
  "config:error": { error: Error; operation: string };

  // 状态相关事件
  "status:updated": { status: any; source: string };
  "status:error": { error: Error; operation: string };

  // 接入点状态变更事件
  "endpoint:status:changed": {
    endpoint: string;
    connected: boolean;
    operation: "connect" | "disconnect" | "reconnect" | "add" | "remove";
    success: boolean;
    message?: string;
    timestamp: number;
    source: string;
  };

  // 服务相关事件
  "service:restart:requested": {
    serviceName: string;
    reason?: string;
    delay: number;
    attempt: number;
    timestamp: number;
    source?: string;
  };
  "service:restart:started": {
    serviceName: string;
    reason?: string;
    attempt: number;
    timestamp: number;
  };
  "service:restart:completed": {
    serviceName: string;
    reason?: string;
    attempt: number;
    timestamp: number;
  };
  "service:restart:failed": {
    serviceName: string;
    error: Error;
    attempt: number;
    timestamp: number;
  };
  "service:restart:execute": {
    serviceName: string;
    reason?: string;
    attempt: number;
    timestamp: number;
  };
  "service:health:changed": {
    serviceName: string;
    oldStatus: string;
    newStatus: string;
    timestamp: number;
  };

  // WebSocket 相关事件
  "websocket:client:connected": { clientId: string; timestamp: number };
  "websocket:client:disconnected": { clientId: string; timestamp: number };
  "websocket:message:received": { type: string; data: any; clientId: string };

  // 通知相关事件
  "notification:broadcast": { type: string; data: any; target?: string };
  "notification:error": { error: Error; type: string };

  // MCP服务相关事件
  "mcp:service:connected": {
    serviceName: string;
    tools: Tool[];
    connectionTime: Date;
  };
  "mcp:service:disconnected": {
    serviceName: string;
    reason?: string;
    disconnectionTime: Date;
  };
  "mcp:service:connection:failed": {
    serviceName: string;
    error: Error;
    attempt: number;
  };
  "mcp:server:added": {
    serverName: string;
    config: any;
    tools: string[];
    timestamp: Date;
  };
  "mcp:server:removed": {
    serverName: string;
    affectedTools: string[];
    timestamp: Date;
  };
  "mcp:server:status_changed": {
    serverName: string;
    oldStatus: "connected" | "disconnected" | "connecting" | "error";
    newStatus: "connected" | "disconnected" | "connecting" | "error";
    timestamp: Date;
    reason?: string;
  };
  "mcp:server:connection:attempt": {
    serverName: string;
    attempt: number;
    maxAttempts: number;
    timestamp: Date;
  };
  "mcp:server:tools:updated": {
    serverName: string;
    tools: string[];
    addedTools: string[];
    removedTools: string[];
    timestamp: Date;
  };
  "mcp:server:batch_added": {
    totalServers: number;
    addedCount: number;
    failedCount: number;
    successfullyAddedServers: string[];
    results: any[];
    timestamp: Date;
  };
  "mcp:server:rollback": {
    serverName: string;
    timestamp: Date;
  };

  // 连接相关事件
  "connection:reconnect:completed": {
    success: boolean;
    reason: string;
    timestamp: Date;
  };

  // 工具同步相关事件
  "tool-sync:server-tools-updated": {
    serviceName: string;
    timestamp: Date;
  };
  "tool-sync:general-config-updated": {
    timestamp: Date;
  };
  "tool-sync:request-service-tools": {
    serviceName: string;
    timestamp: Date;
  };
  "tool-sync:service-tools-removed": {
    serviceName: string;
    removedCount: number;
    timestamp: Date;
  };

  // NPM 安装相关事件
  "npm:install:started": {
    version: string;
    installId: string;
    timestamp: number;
  };
  "npm:install:log": {
    version: string;
    installId: string;
    type: "stdout" | "stderr";
    message: string;
    timestamp: number;
  };
  "npm:install:completed": {
    version: string;
    installId: string;
    success: boolean;
    duration: number;
    timestamp: number;
  };
  "npm:install:failed": {
    version: string;
    installId: string;
    error: string;
    duration: number;
    timestamp: number;
  };

  // 测试相关事件（仅用于测试）
  "high-frequency": {
    id: number;
    timestamp: number;
  };
  "bulk-test": {
    id: number;
    timestamp: number;
  };
  "error-test": {
    error: string;
    timestamp: number;
  };
  "large-data-test": {
    data: any;
    timestamp: number;
  };
  "destroy-test": {
    message: string;
    timestamp: number;
  };
  "chain-event-1": {
    value: number;
    timestamp: number;
  };
  "chain-event-2": {
    value: number;
    timestamp: number;
  };
  "chain-event-3": {
    value: number;
    timestamp: number;
  };
  "performance-test": {
    data: any;
    timestamp: number;
  };
  "test:performance": {
    id: number;
    timestamp: number;
  };
  "chain:start": {
    value: number;
    timestamp: number;
  };
  "chain:middle": {
    value: number;
    timestamp: number;
  };
  "chain:end": {
    value: number;
    timestamp: number;
  };
  "test:error": {
    error: boolean;
    timestamp: number;
  };
  "test:remove": {
    id: number;
    timestamp: number;
  };
}

/**
 * 事件总线 - 用于模块间的解耦通信
 */
export class EventBus extends EventEmitter {
  private logger: Logger;
  private eventStats: Map<string, { count: number; lastEmitted: Date }> =
    new Map();
  private maxListeners = 50; // 增加最大监听器数量

  constructor() {
    super();
    this.logger = logger.withTag("EventBus");
    this.setMaxListeners(this.maxListeners);
    this.setupErrorHandling();
  }

  /**
   * 设置错误处理
   */
  private setupErrorHandling(): void {
    this.on("error", (error) => {
      this.logger.error("EventBus 内部错误:", error);
    });

    // 监听器数量警告
    this.on("newListener", (eventName) => {
      const listenerCount = this.listenerCount(eventName);
      if (listenerCount > this.maxListeners * 0.8) {
        this.logger.warn(
          `事件 ${eventName} 的监听器数量过多: ${listenerCount}`
        );
      }
    });
  }

  /**
   * 发射事件（类型安全）
   */
  emitEvent<K extends keyof EventBusEvents>(
    eventName: K,
    data: EventBusEvents[K]
  ): boolean {
    try {
      this.updateEventStats(eventName as string);
      this.logger.debug(`发射事件: ${eventName}`, data);

      // 使用原始emit方法，保持EventEmitter的所有特性
      return super.emit(eventName, data);
    } catch (error) {
      this.logger.error(`发射事件失败: ${eventName}`, error);
      // 将监听器错误发射到error事件
      if (error instanceof Error) {
        this.emit("error", error);
      }
      return false;
    }
  }

  /**
   * 监听事件（类型安全）
   */
  onEvent<K extends keyof EventBusEvents>(
    eventName: K,
    listener: (data: EventBusEvents[K]) => void
  ): this {
    this.logger.debug(`添加事件监听器: ${eventName}`);
    return this.on(eventName, listener);
  }

  /**
   * 一次性监听事件（类型安全）
   */
  onceEvent<K extends keyof EventBusEvents>(
    eventName: K,
    listener: (data: EventBusEvents[K]) => void
  ): this {
    this.logger.debug(`添加一次性事件监听器: ${eventName}`);

    // 创建包装器来实现一次性监听
    const onceListener = (data: EventBusEvents[K]) => {
      try {
        listener(data);
      } catch (error) {
        // 监听器抛出错误，发射到错误事件
        this.emit("error", error);
        throw error;
      } finally {
        // 在任何情况下都移除监听器
        this.offEvent(eventName, onceListener);
      }
    };

    return this.on(eventName, onceListener);
  }

  /**
   * 移除事件监听器（类型安全）
   */
  offEvent<K extends keyof EventBusEvents>(
    eventName: K,
    listener: (data: EventBusEvents[K]) => void
  ): this {
    this.logger.debug(`移除事件监听器: ${eventName}`);
    return this.off(eventName, listener);
  }

  /**
   * 更新事件统计
   */
  private updateEventStats(eventName: string): void {
    const stats = this.eventStats.get(eventName) || {
      count: 0,
      lastEmitted: new Date(),
    };
    stats.count++;
    stats.lastEmitted = new Date();
    this.eventStats.set(eventName, stats);
  }

  /**
   * 获取事件统计信息
   */
  getEventStats(): Record<string, { count: number; lastEmitted: Date }> {
    const stats: Record<string, { count: number; lastEmitted: Date }> = {};
    for (const [eventName, stat] of this.eventStats) {
      stats[eventName] = { ...stat };
    }
    return stats;
  }

  /**
   * 获取监听器统计信息
   */
  getListenerStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const eventName of this.eventNames()) {
      stats[eventName as string] = this.listenerCount(eventName);
    }
    return stats;
  }

  /**
   * 清理事件统计
   */
  clearEventStats(): void {
    this.eventStats.clear();
    this.logger.info("事件统计已清理");
  }

  /**
   * 获取事件总线状态
   */
  getStatus(): {
    totalEvents: number;
    totalListeners: number;
    eventStats: Record<string, { count: number; lastEmitted: Date }>;
    listenerStats: Record<string, number>;
  } {
    return {
      totalEvents: this.eventStats.size,
      totalListeners: Object.values(this.getListenerStats()).reduce(
        (sum, count) => sum + count,
        0
      ),
      eventStats: this.getEventStats(),
      listenerStats: this.getListenerStats(),
    };
  }

  /**
   * 销毁事件总线
   */
  destroy(): void {
    this.removeAllListeners();
    this.eventStats.clear();
    this.logger.info("EventBus 已销毁");
  }
}

// 单例实例
let eventBusInstance: EventBus | null = null;

/**
 * 获取事件总线单例
 */
export function getEventBus(): EventBus {
  if (!eventBusInstance) {
    eventBusInstance = new EventBus();
  }
  return eventBusInstance;
}

/**
 * 销毁事件总线单例
 */
export function destroyEventBus(): void {
  if (eventBusInstance) {
    eventBusInstance.destroy();
    eventBusInstance = null;
  }
}
