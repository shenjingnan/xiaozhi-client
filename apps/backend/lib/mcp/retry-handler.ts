/**
 * MCP 服务重试处理器
 * 负责管理失败服务的重试逻辑
 */

import { logger } from "@/Logger.js";

/**
 * 重试回调函数类型
 * @param serviceName 服务名称
 * @returns 重试结果
 */
export type RetryCallback = (serviceName: string) => Promise<void>;

/**
 * 重试统计信息接口
 */
export interface RetryStats {
  /** 失败的服务列表 */
  failedServices: string[];
  /** 活跃的重试列表 */
  activeRetries: string[];
  /** 失败服务总数 */
  totalFailed: number;
  /** 活跃重试总数 */
  totalActiveRetries: number;
}

/**
 * 服务重试处理器类
 * 管理服务连接失败后的重试逻辑
 */
export class RetryHandler {
  private retryTimers: Map<string, NodeJS.Timeout> = new Map();
  private failedServices: Set<string> = new Set();
  private retryCallback?: RetryCallback;

  /**
   * 设置重试回调函数
   * @param callback 重试回调函数
   */
  setRetryCallback(callback: RetryCallback): void {
    this.retryCallback = callback;
  }

  /**
   * 安排失败服务的重试
   * @param failedServices 失败的服务列表
   * @param initialDelay 初始延迟时间（毫秒），默认 30000（30秒）
   */
  scheduleFailedServicesRetry(
    failedServices: string[],
    initialDelay = 30000
  ): void {
    if (failedServices.length === 0) return;

    // 记录重试安排
    logger.info(`[RetryHandler] 安排 ${failedServices.length} 个失败服务的重试`);

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

    logger.debug(`[RetryHandler] 安排服务 ${serviceName} 在 ${delay}ms 后重试`);

    const timer = setTimeout(async () => {
      this.retryTimers.delete(serviceName);
      await this.executeRetry(serviceName);
    }, delay);

    this.retryTimers.set(serviceName, timer);
  }

  /**
   * 执行重试
   * @param serviceName 服务名称
   */
  private async executeRetry(serviceName: string): Promise<void> {
    if (!this.failedServices.has(serviceName)) {
      return; // 服务已经成功启动或不再需要重试
    }

    if (!this.retryCallback) {
      logger.warn(`[RetryHandler] 没有设置重试回调，跳过 ${serviceName} 的重试`);
      return;
    }

    try {
      await this.retryCallback(serviceName);

      // 重试成功
      this.failedServices.delete(serviceName);
      logger.info(`[RetryHandler] 服务 ${serviceName} 重试启动成功`);
    } catch (error) {
      logger.error(`[RetryHandler] 服务 ${serviceName} 重试启动失败`, {
        error: (error as Error).message,
      });

      // 指数退避重试策略：延迟时间翻倍，最大不超过5分钟
      const currentDelay = this.getRetryDelay(serviceName);
      const nextDelay = Math.min(currentDelay * 2, 300000); // 最大5分钟

      logger.debug(
        `[RetryHandler] 服务 ${serviceName} 下次重试将在 ${nextDelay}ms 后进行`
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
   * 标记服务重试成功
   * @param serviceName 服务名称
   */
  markSuccess(serviceName: string): void {
    this.failedServices.delete(serviceName);
    this.stopRetry(serviceName);
  }

  /**
   * 停止指定服务的重试
   * @param serviceName 服务名称
   */
  stopRetry(serviceName: string): void {
    const timer = this.retryTimers.get(serviceName);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(serviceName);
      logger.debug(`[RetryHandler] 已停止服务 ${serviceName} 的重试`);
    }
    this.failedServices.delete(serviceName);
  }

  /**
   * 停止所有服务的重试
   */
  stopAllRetries(): void {
    logger.info("[RetryHandler] 停止所有服务重试");

    for (const [serviceName, timer] of this.retryTimers) {
      clearTimeout(timer);
      logger.debug(`[RetryHandler] 已停止服务 ${serviceName} 的重试`);
    }

    this.retryTimers.clear();
    this.failedServices.clear();
  }

  /**
   * 检查服务是否失败
   * @param serviceName 服务名称
   * @returns 如果服务失败返回true
   */
  isFailed(serviceName: string): boolean {
    return this.failedServices.has(serviceName);
  }

  /**
   * 获取失败服务列表
   * @returns 失败的服务名称数组
   */
  getFailedServices(): string[] {
    return Array.from(this.failedServices);
  }

  /**
   * 获取重试统计信息
   * @returns 重试统计信息
   */
  getStats(): RetryStats {
    return {
      failedServices: Array.from(this.failedServices),
      activeRetries: Array.from(this.retryTimers.keys()),
      totalFailed: this.failedServices.size,
      totalActiveRetries: this.retryTimers.size,
    };
  }

  /**
   * 清空所有状态
   */
  clear(): void {
    this.stopAllRetries();
  }
}
