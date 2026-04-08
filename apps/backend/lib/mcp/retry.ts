/**
 * MCP 服务重试管理器
 *
 * 负责管理失败服务的重试逻辑，包括：
 * - 记录失败的服务列表
 * - 安排和管理重试定时器
 * - 实现指数退避重试策略
 *
 * @packageDocumentation
 */

import { logger } from "@/Logger.js";

/**
 * 重试统计信息
 */
export interface RetryStats {
  /** 失败的服务列表 */
  failedServices: string[];
  /** 正在重试的服务列表 */
  activeRetries: string[];
  /** 失败服务总数 */
  totalFailed: number;
  /** 正在重试的服务总数 */
  totalActiveRetries: number;
}

/**
 * 重试回调接口
 * 用于 MCPRetryManager 与父管理器之间的解耦通信
 */
export interface RetryCallbacks {
  /** 重试启动服务 */
  startService: (serviceName: string) => Promise<void>;
  /** 刷新 CustomMCP Handler */
  refreshCustomMCPHandler: () => Promise<void>;
}

/**
 * MCP 服务重试管理器
 *
 * 从 MCPServiceManager 拆分出来的独立服务，负责：
 * - 管理失败服务的重试机制
 * - 实现指数退避重试策略
 * - 提供重试状态查询接口
 */
export class MCPRetryManager {
  /** 重试定时器映射 */
  private retryTimers: Map<string, NodeJS.Timeout> = new Map();
  /** 失败的服务集合 */
  private failedServices: Set<string> = new Set();
  /** 重试回调 */
  private callbacks: RetryCallbacks;
  /** 初始重试延迟（毫秒） */
  private initialDelay = 30000;
  /** 最大重试延迟（毫秒） */
  private maxDelay = 300000;

  /**
   * 创建 MCPRetryManager 实例
   * @param callbacks 重试回调接口
   * @param options 可选配置
   */
  constructor(
    callbacks: RetryCallbacks,
    options?: { initialDelay?: number; maxDelay?: number }
  ) {
    this.callbacks = callbacks;
    if (options?.initialDelay) {
      this.initialDelay = options.initialDelay;
    }
    if (options?.maxDelay) {
      this.maxDelay = options.maxDelay;
    }
  }

  /**
   * 安排多个失败服务的重试
   * @param failedServices 失败的服务列表
   */
  scheduleFailedServicesRetry(failedServices: string[]): void {
    if (failedServices.length === 0) return;

    // 记录重试安排
    logger.info(
      `[MCPRetryManager] 安排 ${failedServices.length} 个失败服务的重试`
    );

    for (const serviceName of failedServices) {
      this.failedServices.add(serviceName);
      this.scheduleServiceRetry(serviceName, this.initialDelay);
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
      `[MCPRetryManager] 安排服务 ${serviceName} 在 ${delay}ms 后重试`
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
      await this.callbacks.startService(serviceName);

      // 重试成功
      this.failedServices.delete(serviceName);
      logger.info(`[MCPRetryManager] 服务 ${serviceName} 重试启动成功`);

      // 重新初始化CustomMCPHandler以包含新启动的服务工具
      try {
        await this.callbacks.refreshCustomMCPHandler();
      } catch (error) {
        logger.error("[MCPRetryManager] 刷新CustomMCPHandler失败", { error });
      }
    } catch (error) {
      logger.error(`[MCPRetryManager] 服务 ${serviceName} 重试启动失败`, {
        error: (error as Error).message,
      });

      // 指数退避重试策略：延迟时间翻倍，最大不超过 maxDelay
      const currentDelay = this.getRetryDelay(serviceName);
      const nextDelay = Math.min(currentDelay * 2, this.maxDelay);

      logger.debug(
        `[MCPRetryManager] 服务 ${serviceName} 下次重试将在 ${nextDelay}ms 后进行`
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
    // 基于服务名称的哈希值计算初始延迟，避免所有服务同时重试
    const hash = serviceName
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return this.initialDelay + (hash % 60000); // 30-90秒之间的初始延迟
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
      logger.debug(`[MCPRetryManager] 已停止服务 ${serviceName} 的重试`);
    }
    this.failedServices.delete(serviceName);
  }

  /**
   * 停止所有服务的重试
   */
  stopAllServiceRetries(): void {
    logger.info("[MCPRetryManager] 停止所有服务重试");

    for (const [serviceName, timer] of this.retryTimers) {
      clearTimeout(timer);
      logger.debug(`[MCPRetryManager] 已停止服务 ${serviceName} 的重试`);
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
   * 清理资源
   */
  cleanup(): void {
    this.stopAllServiceRetries();
  }
}
