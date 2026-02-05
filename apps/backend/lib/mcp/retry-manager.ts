/**
 * MCP 服务重试管理器
 * 负责失败服务的重试逻辑
 */

import type { Logger } from "@/Logger.js";
import { logger } from "@/Logger.js";

/**
 * 重试统计信息接口
 */
export interface RetryStats {
  failedServices: string[];
  activeRetries: string[];
  totalFailed: number;
  totalActiveRetries: number;
}

/**
 * 重试管理器
 * 专注于失败服务的重试逻辑
 */
export class MCPRetryManager {
  private logger: Logger;
  private retryTimers: Map<string, NodeJS.Timeout> = new Map();
  private failedServices: Set<string> = new Set();
  private retryServiceFn: (serviceName: string) => Promise<void>;

  constructor(retryServiceFn: (serviceName: string) => Promise<void>) {
    this.logger = logger;
    this.retryServiceFn = retryServiceFn;
  }

  /**
   * 安排失败服务的重试
   */
  scheduleFailedServicesRetry(failedServices: string[]): void {
    if (failedServices.length === 0) return;

    // 记录重试安排
    this.logger.info(`[RetryManager] 安排 ${failedServices.length} 个失败服务的重试`);

    // 初始重试延迟：30秒
    const initialDelay = 30000;

    for (const serviceName of failedServices) {
      this.failedServices.add(serviceName);
      this.scheduleServiceRetry(serviceName, initialDelay);
    }
  }

  /**
   * 安排单个服务的重试
   */
  private scheduleServiceRetry(serviceName: string, delay: number): void {
    // 清除现有定时器
    const existingTimer = this.retryTimers.get(serviceName);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.retryTimers.delete(serviceName);
    }

    this.logger.debug(`[RetryManager] 安排服务 ${serviceName} 在 ${delay}ms 后重试`);

    const timer = setTimeout(async () => {
      this.retryTimers.delete(serviceName);
      await this.retryFailedService(serviceName);
    }, delay);

    this.retryTimers.set(serviceName, timer);
  }

  /**
   * 重试失败的服务
   */
  private async retryFailedService(serviceName: string): Promise<void> {
    if (!this.failedServices.has(serviceName)) {
      return; // 服务已经成功启动或不再需要重试
    }

    try {
      await this.retryServiceFn(serviceName);

      // 重试成功
      this.failedServices.delete(serviceName);
      this.logger.info(`[RetryManager] 服务 ${serviceName} 重试启动成功`);
    } catch (error) {
      this.logger.error(
        `[RetryManager] 服务 ${serviceName} 重试启动失败:`,
        (error as Error).message
      );

      // 指数退避重试策略：延迟时间翻倍，最大不超过5分钟
      const currentDelay = this.getRetryDelay(serviceName);
      const nextDelay = Math.min(currentDelay * 2, 300000); // 最大5分钟

      this.logger.debug(
        `[RetryManager] 服务 ${serviceName} 下次重试将在 ${nextDelay}ms 后进行`
      );

      this.scheduleServiceRetry(serviceName, nextDelay);
    }
  }

  /**
   * 获取当前重试延迟时间
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
   */
  stopServiceRetry(serviceName: string): void {
    const timer = this.retryTimers.get(serviceName);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(serviceName);
      this.logger.debug(`[RetryManager] 已停止服务 ${serviceName} 的重试`);
    }
    this.failedServices.delete(serviceName);
  }

  /**
   * 停止所有服务的重试
   */
  stopAllServiceRetries(): void {
    this.logger.info("[RetryManager] 停止所有服务重试");

    for (const [serviceName, timer] of this.retryTimers) {
      clearTimeout(timer);
      this.logger.debug(`[RetryManager] 已停止服务 ${serviceName} 的重试`);
    }

    this.retryTimers.clear();
    this.failedServices.clear();
  }

  /**
   * 获取失败服务列表
   */
  getFailedServices(): string[] {
    return Array.from(this.failedServices);
  }

  /**
   * 检查服务是否失败
   */
  isServiceFailed(serviceName: string): boolean {
    return this.failedServices.has(serviceName);
  }

  /**
   * 获取重试统计信息
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
