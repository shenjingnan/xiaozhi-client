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
    operation: "connect" | "disconnect" | "reconnect";
    success: boolean;
    message?: string;
    timestamp: number;
    source: string;
  };

  // 服务相关事件
  "service:restart:requested": { source: string };
  "service:restart:started": { timestamp: number };
  "service:restart:completed": { timestamp: number };
  "service:restart:failed": { error: Error; timestamp: number };

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

  // 工具同步相关事件
  "tool-sync:server-tools-updated": {
    serviceName: string;
    timestamp: Date;
  };
  "tool-sync:general-config-updated": {
    timestamp: Date;
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
      return this.emit(eventName, data);
    } catch (error) {
      this.logger.error(`发射事件失败: ${eventName}`, error);
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
    return this.once(eventName, listener);
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
