/**
 * MCP 服务生命周期管理器
 * 负责管理 MCP 服务的启动、停止、重试等生命周期操作
 * 从 MCPServiceManager 中拆分出来，遵循单一职责原则
 */

import { logger } from "@/Logger.js";
import { MCPService } from "@/lib/mcp/connection.js";
import type {
  InternalMCPServiceConfig,
  MCPServiceConfig,
} from "@/lib/mcp/types.js";
import type { EventBus } from "@/services/event-bus.service.js";
import { getEventBus } from "@/services/event-bus.service.js";
import type { CustomMCPHandler } from "../custom.js";

/**
 * 服务重试统计信息
 */
interface RetryStats {
  failedServices: string[];
  activeRetries: string[];
  totalFailed: number;
  totalActiveRetries: number;
}

/**
 * MCP 服务生命周期管理器
 * 负责服务的启动、停止、重试等操作
 */
export class MCPServiceLifecycleManager {
  private services: Map<string, MCPService> = new Map();
  private configs: Record<string, MCPServiceConfig> = {};
  private retryTimers: Map<string, NodeJS.Timeout> = new Map();
  private failedServices: Set<string> = new Set();
  private customMCPHandler: CustomMCPHandler;
  private eventBus: EventBus;
  private refreshCustomMCPHandlerCallback: () => Promise<void>;

  constructor(
    configs: Record<string, MCPServiceConfig>,
    customMCPHandler: CustomMCPHandler,
    refreshCustomMCPHandlerCallback: () => Promise<void>
  ) {
    this.configs = configs;
    this.customMCPHandler = customMCPHandler;
    this.eventBus = getEventBus();
    this.refreshCustomMCPHandlerCallback = refreshCustomMCPHandlerCallback;
  }

  /**
   * 启动所有 MCP 服务
   */
  async startAllServices(): Promise<void> {
    logger.debug("[LifecycleManager] 正在启动所有 MCP 服务...");

    // 初始化 CustomMCP 处理器
    try {
      this.customMCPHandler.initialize();
      logger.debug("[LifecycleManager] CustomMCP 处理器初始化完成");
    } catch (error) {
      logger.error("[LifecycleManager] CustomMCP 处理器初始化失败:", error);
      // CustomMCP 初始化失败不应该阻止标准 MCP 服务启动
    }

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
        await this.startService(serviceName);
        return { serviceName, success: true, error: null };
      } catch (error) {
        return {
          serviceName,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
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
   */
  async startService(serviceName: string): Promise<void> {
    const config = this.configs[serviceName];
    if (!config) {
      throw new Error(`未找到服务配置: ${serviceName}`);
    }

    try {
      // 如果服务已存在，先停止它
      if (this.services.has(serviceName)) {
        await this.stopService(serviceName);
      }

      // 创建 MCPService 实例（使用 InternalMCPServiceConfig）
      const serviceConfig: InternalMCPServiceConfig = {
        name: serviceName,
        ...config,
      };
      const service = new MCPService(serviceConfig);

      // 连接到服务
      await service.connect();

      // 存储服务实例
      this.services.set(serviceName, service);

      // 从失败服务集合中移除（如果之前失败了）
      this.failedServices.delete(serviceName);

      const tools = service.getTools();
      logger.debug(
        `[LifecycleManager] ${serviceName} 服务启动成功，加载了 ${tools.length} 个工具:`,
        tools.map((t) => t.name).join(", ")
      );
    } catch (error) {
      logger.error(
        `[LifecycleManager] 启动 ${serviceName} 服务失败:`,
        (error as Error).message
      );
      // 清理可能的部分状态
      this.services.delete(serviceName);
      throw error;
    }
  }

  /**
   * 停止单个服务
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

      logger.info(`[LifecycleManager] ${serviceName} 服务已停止`);
    } catch (error) {
      logger.error(
        `[LifecycleManager] 停止 ${serviceName} 服务失败:`,
        (error as Error).message
      );
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
        logger.error(
          `[LifecycleManager] 停止 ${serviceName} 服务失败:`,
          (error as Error).message
        );
      }
    }

    // 清理 CustomMCP 处理器
    try {
      this.customMCPHandler.cleanup();
      logger.info("[LifecycleManager] CustomMCP 处理器已清理");
    } catch (error) {
      logger.error("[LifecycleManager] CustomMCP 处理器清理失败:", error);
    }

    this.services.clear();

    logger.info("[LifecycleManager] 所有 MCP 服务已停止");
  }

  /**
   * 安排失败服务的重试
   * @param failedServices 失败的服务列表
   */
  private scheduleFailedServicesRetry(failedServices: string[]): void {
    if (failedServices.length === 0) return;

    // 记录重试安排
    logger.info(
      `[LifecycleManager] 安排 ${failedServices.length} 个失败服务的重试`
    );

    // 初始重试延迟：30秒
    const initialDelay = 30000;

    for (const serviceName of failedServices) {
      this.failedServices.add(serviceName);
      this.scheduleServiceRetry(serviceName, initialDelay);
    }
  }

  /**
   * 安排单个服务的重试
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

    logger.debug(
      `[LifecycleManager] 安排服务 ${serviceName} 在 ${delay}ms 后重试`
    );

    const timer = setTimeout(async () => {
      this.retryTimers.delete(serviceName);
      await this.retryFailedService(serviceName);
    }, delay);

    this.retryTimers.set(serviceName, timer);
  }

  /**
   * 重试失败的服务
   * @param serviceName 服务名称
   */
  private async retryFailedService(serviceName: string): Promise<void> {
    if (!this.failedServices.has(serviceName)) {
      return; // 服务已经成功启动或不再需要重试
    }

    try {
      await this.startService(serviceName);

      // 重试成功
      this.failedServices.delete(serviceName);
      logger.info(`[LifecycleManager] 服务 ${serviceName} 重试启动成功`);

      // 重新初始化CustomMCPHandler以包含新启动的服务工具
      try {
        await this.refreshCustomMCPHandlerCallback();
      } catch (error) {
        logger.error("[LifecycleManager] 刷新CustomMCPHandler失败:", error);
      }
    } catch (error) {
      logger.error(
        `[LifecycleManager] 服务 ${serviceName} 重试启动失败:`,
        (error as Error).message
      );

      // 指数退避重试策略：延迟时间翻倍，最大不超过5分钟
      const currentDelay = this.getRetryDelay(serviceName);
      const nextDelay = Math.min(currentDelay * 2, 300000); // 最大5分钟

      logger.debug(
        `[LifecycleManager] 服务 ${serviceName} 下次重试将在 ${nextDelay}ms 后进行`
      );

      this.scheduleServiceRetry(serviceName, nextDelay);
    }
  }

  /**
   * 获取当前重试延迟时间
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
   * @returns 失败的服务名称数组
   */
  getFailedServices(): string[] {
    return Array.from(this.failedServices);
  }

  /**
   * 检查服务是否失败
   * @param serviceName 服务名称
   * @returns 如果服务失败返回true
   */
  isServiceFailed(serviceName: string): boolean {
    return this.failedServices.has(serviceName);
  }

  /**
   * 获取重试统计信息
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
   * 添加服务配置
   * @param name 服务名称
   * @param config 服务配置
   */
  addServiceConfig(name: string, config: MCPServiceConfig): void {
    this.configs[name] = config;
    logger.debug(`[LifecycleManager] 已添加服务配置: ${name}`);
  }

  /**
   * 更新服务配置
   * @param name 服务名称
   * @param config 服务配置
   */
  updateServiceConfig(name: string, config: MCPServiceConfig): void {
    this.configs[name] = config;
    logger.debug(`[LifecycleManager] 已更新服务配置: ${name}`);
  }

  /**
   * 移除服务配置
   * @param name 服务名称
   */
  removeServiceConfig(name: string): void {
    delete this.configs[name];
    logger.debug(`[LifecycleManager] 已移除服务配置: ${name}`);
  }

  /**
   * 获取服务配置
   * @param name 服务名称
   * @returns 服务配置或 undefined
   */
  getServiceConfig(name: string): MCPServiceConfig | undefined {
    return this.configs[name];
  }

  /**
   * 获取所有服务配置
   * @returns 所有服务配置
   */
  getAllServiceConfigs(): Record<string, MCPServiceConfig> {
    return { ...this.configs };
  }

  /**
   * 获取指定服务实例
   * @param name 服务名称
   * @returns 服务实例或 undefined
   */
  getService(name: string): MCPService | undefined {
    return this.services.get(name);
  }

  /**
   * 获取所有服务实例
   * @returns 服务 Map 的副本
   */
  getAllServices(): Map<string, MCPService> {
    return new Map(this.services);
  }

  /**
   * 获取所有已连接的服务名称
   * @returns 已连接的服务名称数组
   */
  getConnectedServices(): string[] {
    const connectedServices: string[] = [];
    for (const [serviceName, service] of this.services) {
      if (service.isConnected()) {
        connectedServices.push(serviceName);
      }
    }
    return connectedServices;
  }
}
