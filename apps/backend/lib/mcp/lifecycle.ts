/**
 * MCP 服务生命周期管理器
 * 负责管理 MCP 服务的启动、停止和重试逻辑
 *
 * @remarks
 * 该类从 MCPServiceManager 中分离出来，专门负责服务生命周期管理。
 * 这符合单一职责原则（SRP），使代码更易于维护和测试。
 *
 * @example
 * ```typescript
 * const lifecycleManager = new MCPServiceLifecycleManager(services, configs, {
 *   onServiceStarted: async (serviceName) => { ... },
 *   onServiceFailed: async (serviceName, error) => { ... }
 * });
 * await lifecycleManager.startAllServices();
 * ```
 */

import { logger } from "@/Logger.js";
import type { MCPService } from "@/lib/mcp/connection.js";
import type { MCPServiceConfig } from "@/lib/mcp/types.js";
import { getEventBus } from "@/services/event-bus.service.js";

/**
 * 服务生命周期事件回调接口
 */
export interface LifecycleEventCallbacks {
  /** 服务启动成功回调 */
  onServiceStarted?: (serviceName: string) => Promise<void>;
  /** 服务启动失败回调 */
  onServiceFailed?: (serviceName: string, error: Error) => Promise<void>;
  /** 服务停止回调 */
  onServiceStopped?: (serviceName: string) => Promise<void>;
}

/**
 * 重试统计信息
 */
export interface RetryStats {
  /** 失败的服务列表 */
  failedServices: string[];
  /** 活跃的重试列表 */
  activeRetries: string[];
  /** 总失败数 */
  totalFailed: number;
  /** 总活跃重试数 */
  totalActiveRetries: number;
}

/**
 * 服务启动结果
 */
interface ServiceStartResult {
  serviceName: string;
  success: boolean;
  error: string | null;
}

/**
 * MCP 服务生命周期管理器
 *
 * @remarks
 * 负责管理 MCP 服务的启动、停止和重试逻辑。
 * 不负责工具管理、配置增强等功能。
 */
export class MCPServiceLifecycleManager {
  private services: Map<string, MCPService>;
  private configs: Record<string, MCPServiceConfig>;
  private eventBus = getEventBus();
  private retryTimers: Map<string, NodeJS.Timeout> = new Map();
  private failedServices: Set<string> = new Set();
  private eventListeners: {
    serviceConnected: (data: {
      serviceName: string;
      tools: unknown[];
      connectionTime: Date;
    }) => void;
    serviceDisconnected: (data: {
      serviceName: string;
      reason?: string;
      disconnectionTime: Date;
    }) => void;
    serviceConnectionFailed: (data: {
      serviceName: string;
      error: Error;
      attempt: number;
    }) => void;
  } | null = null;

  private callbacks: LifecycleEventCallbacks;

  /**
   * 创建生命周期管理器实例
   *
   * @param services 服务实例映射的引用
   * @param configs 服务配置对象的引用
   * @param callbacks 生命周期事件回调
   */
  constructor(
    services: Map<string, MCPService>,
    configs: Record<string, MCPServiceConfig>,
    callbacks: LifecycleEventCallbacks = {}
  ) {
    this.services = services;
    this.configs = configs;
    this.callbacks = callbacks;
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners(): void {
    if (this.eventListeners) {
      return; // 已经设置过了
    }

    this.eventListeners = {
      serviceConnected: async (data) => {
        await this.handleServiceConnected(data);
      },
      serviceDisconnected: async (data) => {
        await this.handleServiceDisconnected(data);
      },
      serviceConnectionFailed: async (data) => {
        await this.handleServiceConnectionFailed(data);
      },
    };

    // 监听 MCP 服务连接成功事件
    this.eventBus.onEvent(
      "mcp:service:connected",
      this.eventListeners.serviceConnected
    );

    // 监听 MCP 服务断开连接事件
    this.eventBus.onEvent(
      "mcp:service:disconnected",
      this.eventListeners.serviceDisconnected
    );

    // 监听 MCP 服务连接失败事件
    this.eventBus.onEvent(
      "mcp:service:connection:failed",
      this.eventListeners.serviceConnectionFailed
    );
  }

  /**
   * 清理事件监听器
   */
  cleanupEventListeners(): void {
    if (!this.eventListeners) {
      return;
    }

    this.eventBus.offEvent(
      "mcp:service:connected",
      this.eventListeners.serviceConnected
    );
    this.eventBus.offEvent(
      "mcp:service:disconnected",
      this.eventListeners.serviceDisconnected
    );
    this.eventBus.offEvent(
      "mcp:service:connection:failed",
      this.eventListeners.serviceConnectionFailed
    );

    this.eventListeners = null;
  }

  /**
   * 处理 MCP 服务连接成功事件
   */
  private async handleServiceConnected(data: {
    serviceName: string;
    tools: unknown[];
    connectionTime: Date;
  }): Promise<void> {
    logger.debug(`服务 ${data.serviceName} 连接成功`);

    // 从失败集合中移除
    this.failedServices.delete(data.serviceName);

    // 触发回调
    if (this.callbacks.onServiceStarted) {
      try {
        await this.callbacks.onServiceStarted(data.serviceName);
      } catch (error) {
        logger.error(`服务 ${data.serviceName} 启动回调失败`, { error });
      }
    }
  }

  /**
   * 处理 MCP 服务断开连接事件
   */
  private async handleServiceDisconnected(data: {
    serviceName: string;
    reason?: string;
    disconnectionTime: Date;
  }): Promise<void> {
    logger.info(
      `服务 ${data.serviceName} 断开连接，原因: ${data.reason || "未知"}`
    );

    // 触发回调
    if (this.callbacks.onServiceStopped) {
      try {
        await this.callbacks.onServiceStopped(data.serviceName);
      } catch (error) {
        logger.error(`服务 ${data.serviceName} 停止回调失败`, { error });
      }
    }
  }

  /**
   * 处理 MCP 服务连接失败事件
   */
  private async handleServiceConnectionFailed(data: {
    serviceName: string;
    error: Error;
    attempt: number;
  }): Promise<void> {
    // 触发失败回调
    if (this.callbacks.onServiceFailed) {
      try {
        await this.callbacks.onServiceFailed(data.serviceName, data.error);
      } catch (error) {
        logger.error(`服务 ${data.serviceName} 失败回调执行失败`, { error });
      }
    }
  }

  /**
   * 启动所有 MCP 服务
   *
   * @remarks
   * 并行启动所有服务，实现服务隔离。
   * 启动失败的服务会被安排重试。
   */
  async startAllServices(
    MCPServiceClass: new (config: { name: string } & MCPServiceConfig) => MCPService
  ): Promise<void> {
    logger.debug("[LifecycleManager] 正在启动所有 MCP 服务...");

    const configEntries = Object.entries(this.configs);
    if (configEntries.length === 0) {
      logger.warn(
        "[LifecycleManager] 没有配置任何 MCP 服务，请使用 addServiceConfig() 添加服务配置"
      );
      return;
    }

    // 记录启动开始
    logger.info(
      `[LifecycleManager] 开始并行启动 ${configEntries.length} 个 MCP 服务`
    );

    // 并行启动所有服务，实现服务隔离
    const startPromises = configEntries.map(async ([serviceName]) => {
      try {
        await this.startService(serviceName, MCPServiceClass);
        return {
          serviceName,
          success: true,
          error: null,
        } satisfies ServiceStartResult;
      } catch (error) {
        return {
          serviceName,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        } satisfies ServiceStartResult;
      }
    });

    // 等待所有服务启动完成
    const results = await Promise.allSettled(startPromises);

    // 统计启动结果
    let successCount = 0;
    let failureCount = 0;
    const failedServices: string[] = [];

    for (const result of results) {
      if (result.status === "fulfilled") {
        if (result.value.success) {
          successCount++;
        } else {
          failureCount++;
          failedServices.push(result.value.serviceName);
        }
      } else {
        failureCount++;
      }
    }

    // 记录启动完成统计
    logger.info(
      `[LifecycleManager] 服务启动完成 - 成功: ${successCount}, 失败: ${failureCount}`
    );

    // 记录失败的服务列表
    if (failedServices.length > 0) {
      logger.warn(
        `[LifecycleManager] 以下服务启动失败: ${failedServices.join(", ")}`
      );

      // 如果所有服务都失败了，发出警告但系统继续运行以便重试
      if (failureCount === configEntries.length) {
        logger.warn(
          "[LifecycleManager] 所有 MCP 服务启动失败，但系统将继续运行以便重试"
        );
      }
    }

    // 启动失败服务重试机制
    if (failedServices.length > 0) {
      this.scheduleFailedServicesRetry(failedServices);
    }
  }

  /**
   * 启动单个 MCP 服务
   *
   * @param serviceName 服务名称
   * @param MCPServiceClass MCP 服务类
   * @throws {Error} 如果未找到服务配置或启动失败
   */
  async startService(
    serviceName: string,
    MCPServiceClass: new (config: { name: string } & MCPServiceConfig) => MCPService
  ): Promise<void> {
    const config = this.configs[serviceName];
    if (!config) {
      throw new Error(`未找到服务配置: ${serviceName}`);
    }

    try {
      // 如果服务已存在，先停止它
      if (this.services.has(serviceName)) {
        await this.stopService(serviceName);
      }

      // 创建 MCPService 实例
      const serviceConfig = {
        name: serviceName,
        ...config,
      };
      const service = new MCPServiceClass(serviceConfig);

      // 连接到服务
      await service.connect();

      // 存储服务实例
      this.services.set(serviceName, service);

      const tools = service.getTools();
      logger.debug(
        `[LifecycleManager] ${serviceName} 服务启动成功，加载了 ${tools.length} 个工具:`,
        tools.map((t) => t.name).join(", ")
      );
    } catch (error) {
      logger.error(`[LifecycleManager] 启动 ${serviceName} 服务失败`, {
        error: (error as Error).message,
      });
      // 清理可能的部分状态
      this.services.delete(serviceName);
      throw error;
    }
  }

  /**
   * 停止单个服务
   *
   * @param serviceName 服务名称
   */
  async stopService(serviceName: string): Promise<void> {
    logger.info(`[LifecycleManager] 停止 MCP 服务: ${serviceName}`);

    const service = this.services.get(serviceName);
    if (!service) {
      logger.warn(`[LifecycleManager] 服务 ${serviceName} 不存在或未启动`);
      return;
    }

    try {
      await service.disconnect();
      this.services.delete(serviceName);
      this.stopServiceRetry(serviceName);

      logger.info(`[LifecycleManager] ${serviceName} 服务已停止`);
    } catch (error) {
      logger.error(`[LifecycleManager] 停止 ${serviceName} 服务失败`, {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 停止所有服务
   */
  async stopAllServices(): Promise<void> {
    logger.info("[LifecycleManager] 正在停止所有 MCP 服务...");

    // 停止所有服务重试
    this.stopAllServiceRetries();

    // 停止所有服务实例
    for (const [serviceName, service] of this.services) {
      try {
        await service.disconnect();
        logger.info(`[LifecycleManager] ${serviceName} 服务已停止`);
      } catch (error) {
        logger.error(`[LifecycleManager] 停止 ${serviceName} 服务失败`, {
          error: (error as Error).message,
        });
      }
    }

    this.services.clear();

    logger.info("[LifecycleManager] 所有 MCP 服务已停止");
  }

  /**
   * 安排失败服务的重试
   *
   * @param failedServices 失败的服务列表
   */
  private scheduleFailedServicesRetry(failedServices: string[]): void {
    if (failedServices.length === 0) return;

    // 记录重试安排
    logger.info(`[LifecycleManager] 安排 ${failedServices.length} 个失败服务的重试`);

    // 初始重试延迟：30秒
    const initialDelay = 30000;

    for (const serviceName of failedServices) {
      this.failedServices.add(serviceName);
      this.scheduleServiceRetry(serviceName, initialDelay);
    }
  }

  /**
   * 安排单个服务的重试
   *
   * @param serviceName 服务名称
   * @param delay 延迟时间（毫秒）
   */
  private scheduleServiceRetry(serviceName: string, delay: number): void {
    // 清除现有定时器
    const existingTimer = this.retryTimers.get(serviceName);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.retryTimers.delete(serviceName);
    }

    logger.debug(`[LifecycleManager] 安排服务 ${serviceName} 在 ${delay}ms 后重试`);

    const timer = setTimeout(async () => {
      this.retryTimers.delete(serviceName);
      await this.retryFailedService(serviceName);
    }, delay);

    this.retryTimers.set(serviceName, timer);
  }

  /**
   * 重试失败的服务
   *
   * @param serviceName 服务名称
   */
  private async retryFailedService(
    serviceName: string,
    MCPServiceClass?: new (config: { name: string } & MCPServiceConfig) => MCPService
  ): Promise<void> {
    if (!this.failedServices.has(serviceName)) {
      return; // 服务已经成功启动或不再需要重试
    }

    if (!MCPServiceClass) {
      logger.warn(`[LifecycleManager] 无法重试服务 ${serviceName}，未提供 MCPServiceClass`);
      return;
    }

    try {
      await this.startService(serviceName, MCPServiceClass);

      // 重试成功
      this.failedServices.delete(serviceName);
      logger.info(`[LifecycleManager] 服务 ${serviceName} 重试启动成功`);

      // 触发成功回调
      if (this.callbacks.onServiceStarted) {
        try {
          await this.callbacks.onServiceStarted(serviceName);
        } catch (error) {
          logger.error(`服务 ${serviceName} 启动回调失败`, { error });
        }
      }
    } catch (error) {
      logger.error(`[LifecycleManager] 服务 ${serviceName} 重试启动失败`, {
        error: (error as Error).message,
      });

      // 指数退避重试策略：延迟时间翻倍，最大不超过5分钟
      const currentDelay = this.getRetryDelay(serviceName);
      const nextDelay = Math.min(currentDelay * 2, 300000); // 最大5分钟

      logger.debug(
        `[LifecycleManager] 服务 ${serviceName} 下次重试将在 ${nextDelay}ms 后进行`
      );

      // 安排下次重试
      if (this.failedServices.has(serviceName)) {
        this.scheduleServiceRetry(serviceName, nextDelay);
      }
    }
  }

  /**
   * 获取当前重试延迟时间
   *
   * @param serviceName 服务名称
   * @returns 当前延迟时间
   */
  private getRetryDelay(serviceName: string): number {
    // 这里可以实现更复杂的状态跟踪来计算准确的延迟
    // 简化实现：返回一个基于服务名称的哈希值的初始延迟
    const hash = serviceName
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return 30000 + (hash % 60000); // 30-90秒之间的初始延迟
  }

  /**
   * 停止指定服务的重试
   *
   * @param serviceName 服务名称
   */
  stopServiceRetry(serviceName: string): void {
    const timer = this.retryTimers.get(serviceName);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(serviceName);
      logger.debug(`[LifecycleManager] 已停止服务 ${serviceName} 的重试`);
    }
    this.failedServices.delete(serviceName);
  }

  /**
   * 停止所有服务的重试
   */
  stopAllServiceRetries(): void {
    logger.info("[LifecycleManager] 停止所有服务重试");

    for (const [serviceName, timer] of this.retryTimers) {
      clearTimeout(timer);
      logger.debug(`[LifecycleManager] 已停止服务 ${serviceName} 的重试`);
    }

    this.retryTimers.clear();
    this.failedServices.clear();
  }

  /**
   * 获取失败服务列表
   *
   * @returns 失败的服务名称数组
   */
  getFailedServices(): string[] {
    return Array.from(this.failedServices);
  }

  /**
   * 检查服务是否失败
   *
   * @param serviceName 服务名称
   * @returns 如果服务失败返回 true
   */
  isServiceFailed(serviceName: string): boolean {
    return this.failedServices.has(serviceName);
  }

  /**
   * 获取重试统计信息
   *
   * @returns 重试统计信息
   */
  getRetryStats(): RetryStats {
    return {
      failedServices: Array.from(this.failedServices),
      activeRetries: Array.from(this.retryTimers.keys()),
      totalFailed: this.failedServices.size,
      totalActiveRetries: this.retryTimers.size,
    };
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.cleanupEventListeners();
    this.stopAllServiceRetries();
  }
}
