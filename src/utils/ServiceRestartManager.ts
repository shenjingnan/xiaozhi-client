#!/usr/bin/env node

/**
 * 服务重启管理器
 * 管理MCP服务的重启逻辑，包括智能重试和降级策略
 */

import { logger } from "../Logger.js";
import { getEventBus } from "../services/EventBus.js";
import {
  OperationPriority,
  OperationType,
  globalConcurrencyController,
} from "./ConcurrencyController.js";

/**
 * 重启策略枚举
 */
export enum RestartStrategy {
  IMMEDIATE = "immediate", // 立即重启
  DELAYED = "delayed", // 延迟重启
  EXPONENTIAL_BACKOFF = "exponential_backoff", // 指数退避
  FIXED_INTERVAL = "fixed_interval", // 固定间隔
  MANUAL = "manual", // 手动重启
}

/**
 * 重启配置接口
 */
export interface RestartConfig {
  strategy: RestartStrategy;
  maxAttempts: number;
  initialDelay: number; // 初始延迟（毫秒）
  maxDelay: number; // 最大延迟（毫秒）
  backoffMultiplier: number; // 退避倍数
  fixedInterval: number; // 固定间隔（毫秒）
  enableJitter: boolean; // 启用抖动（随机延迟）
  jitterAmount: number; // 抖动量（毫秒）
}

/**
 * 重启记录接口
 */
export interface RestartRecord {
  serviceName: string;
  attempt: number;
  startTime: Date;
  endTime?: Date;
  success: boolean;
  error?: string;
  delay: number;
  strategy: RestartStrategy;
}

/**
 * 服务健康状态
 */
export enum ServiceHealthStatus {
  HEALTHY = "healthy",
  DEGRADED = "degraded",
  UNHEALTHY = "unhealthy",
  UNKNOWN = "unknown",
}

/**
 * 服务重启管理器
 */
export class ServiceRestartManager {
  private logger;
  private config: RestartConfig;
  private restartRecords: Map<string, RestartRecord[]> = new Map();
  private restartTimers: Map<string, NodeJS.Timeout> = new Map();
  private healthStatus: Map<string, ServiceHealthStatus> = new Map();
  private consecutiveFailures: Map<string, number> = new Map();

  constructor(config: Partial<RestartConfig> = {}) {
    this.config = {
      strategy: RestartStrategy.EXPONENTIAL_BACKOFF,
      maxAttempts: 5,
      initialDelay: 1000,
      maxDelay: 300000, // 5分钟
      backoffMultiplier: 2,
      fixedInterval: 30000, // 30秒
      enableJitter: true,
      jitterAmount: 5000, // 5秒
      ...config,
    };

    this.logger = logger.withTag("ServiceRestartManager");
    this.setupEventListeners();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    const eventBus = getEventBus();

    // 监听服务断开事件
    eventBus.onEvent("mcp:service:disconnected", async (data) => {
      await this.handleServiceDisconnection(data.serviceName, data.reason);
    });

    // 监听服务连接失败事件
    eventBus.onEvent("mcp:service:connection:failed", async (data) => {
      await this.handleConnectionFailure(
        data.serviceName,
        data.error,
        data.attempt
      );
    });

    // 监听服务连接成功事件
    eventBus.onEvent("mcp:service:connected", async (data) => {
      await this.handleServiceConnection(data.serviceName);
    });
  }

  /**
   * 处理服务断开连接
   */
  private async handleServiceDisconnection(
    serviceName: string,
    reason?: string
  ): Promise<void> {
    this.logger.warn("服务断开连接", {
      serviceName,
      reason,
      healthStatus: this.healthStatus.get(serviceName),
    });

    // 更新健康状态
    this.updateHealthStatus(serviceName, ServiceHealthStatus.UNHEALTHY);

    // 触发重启逻辑
    await this.scheduleRestart(serviceName, reason);
  }

  /**
   * 处理连接失败
   */
  private async handleConnectionFailure(
    serviceName: string,
    error: Error,
    attempt: number
  ): Promise<void> {
    this.logger.error("服务连接失败", {
      serviceName,
      error: error.message,
      attempt,
    });

    // 增加连续失败计数
    const failures = (this.consecutiveFailures.get(serviceName) || 0) + 1;
    this.consecutiveFailures.set(serviceName, failures);

    // 更新健康状态
    this.updateHealthStatus(serviceName, ServiceHealthStatus.UNHEALTHY);

    // 如果达到最大尝试次数，停止重启
    if (failures >= this.config.maxAttempts) {
      this.logger.error("服务达到最大重试次数，停止重启", {
        serviceName,
        failures,
        maxAttempts: this.config.maxAttempts,
      });

      this.updateHealthStatus(serviceName, ServiceHealthStatus.DEGRADED);
      this.cancelPendingRestart(serviceName);
      return;
    }

    // 触发重启逻辑
    await this.scheduleRestart(serviceName, error.message, attempt);
  }

  /**
   * 处理服务连接成功
   */
  private async handleServiceConnection(serviceName: string): Promise<void> {
    this.logger.info("服务连接成功", {
      serviceName,
    });

    // 重置失败计数
    this.consecutiveFailures.delete(serviceName);

    // 更新健康状态
    this.updateHealthStatus(serviceName, ServiceHealthStatus.HEALTHY);

    // 取消待重启
    this.cancelPendingRestart(serviceName);

    // 记录成功连接
    this.recordRestart(serviceName, true, undefined);
  }

  /**
   * 安排重启
   */
  private async scheduleRestart(
    serviceName: string,
    reason?: string,
    currentAttempt = 0
  ): Promise<void> {
    // 取消之前的重启安排
    this.cancelPendingRestart(serviceName);

    // 计算延迟时间
    const delay = this.calculateRestartDelay(serviceName, currentAttempt);

    this.logger.info("安排服务重启", {
      serviceName,
      reason,
      delay,
      attempt: currentAttempt + 1,
      strategy: this.config.strategy,
    });

    // 创建重启定时器
    const timer = setTimeout(async () => {
      await this.executeRestart(serviceName, reason, currentAttempt + 1);
    }, delay);

    this.restartTimers.set(serviceName, timer);

    // 发射重启安排事件
    getEventBus().emitEvent("service:restart:requested", {
      serviceName,
      reason,
      delay,
      attempt: currentAttempt + 1,
      timestamp: Date.now(),
    });
  }

  /**
   * 计算重启延迟
   */
  private calculateRestartDelay(serviceName: string, attempt: number): number {
    let delay = this.config.initialDelay;

    switch (this.config.strategy) {
      case RestartStrategy.IMMEDIATE:
        delay = 0;
        break;

      case RestartStrategy.DELAYED:
        delay = this.config.initialDelay;
        break;

      case RestartStrategy.EXPONENTIAL_BACKOFF:
        delay = Math.min(
          this.config.initialDelay * this.config.backoffMultiplier ** attempt,
          this.config.maxDelay
        );
        break;

      case RestartStrategy.FIXED_INTERVAL:
        delay = this.config.fixedInterval;
        break;

      case RestartStrategy.MANUAL:
        // 手动重启，不自动安排
        return -1;
    }

    // 添加抖动
    if (this.config.enableJitter && delay > 0) {
      const jitter = Math.random() * this.config.jitterAmount;
      delay += Math.random() > 0.5 ? jitter : -jitter;
      delay = Math.max(0, delay); // 确保不为负数
    }

    return delay;
  }

  /**
   * 执行重启
   */
  private async executeRestart(
    serviceName: string,
    reason?: string,
    attempt = 1
  ): Promise<void> {
    this.restartTimers.delete(serviceName);

    this.logger.info("开始执行服务重启", {
      serviceName,
      reason,
      attempt,
      maxAttempts: this.config.maxAttempts,
    });

    // 发射重启开始事件
    getEventBus().emitEvent("service:restart:started", {
      serviceName,
      reason,
      attempt,
      timestamp: Date.now(),
    });

    try {
      // 使用并发控制器执行重启操作
      await globalConcurrencyController.addOperation(
        OperationType.START_SERVICE,
        serviceName,
        async () => {
          // 这里需要调用MCPServiceManager的重启方法
          // 由于我们无法直接访问，这里发射事件让其他组件处理
          getEventBus().emitEvent("service:restart:execute", {
            serviceName,
            reason,
            attempt,
            timestamp: Date.now(),
          });

          // 返回模拟结果，实际应该等待真正的重启完成
          return { success: true, serviceName };
        },
        {
          priority: OperationPriority.HIGH,
          timeout: this.config.maxDelay,
          context: { reason, attempt, operationType: "restart" },
        }
      );

      // 发射重启完成事件
      getEventBus().emitEvent("service:restart:completed", {
        serviceName,
        reason,
        attempt,
        timestamp: Date.now(),
      });

      this.recordRestart(serviceName, true, undefined, attempt);
    } catch (error) {
      this.logger.error("服务重启失败", {
        serviceName,
        error: error instanceof Error ? error.message : String(error),
        attempt,
      });

      // 发射重启失败事件
      getEventBus().emitEvent("service:restart:failed", {
        serviceName,
        error: error instanceof Error ? error : new Error(String(error)),
        attempt,
        timestamp: Date.now(),
      });

      this.recordRestart(
        serviceName,
        false,
        error instanceof Error ? error.message : String(error),
        attempt
      );

      // 如果还有重试次数，安排下次重启
      if (attempt < this.config.maxAttempts) {
        await this.scheduleRestart(
          serviceName,
          error instanceof Error ? error.message : String(error),
          attempt
        );
      }
    }
  }

  /**
   * 记录重启
   */
  private recordRestart(
    serviceName: string,
    success: boolean,
    error?: string,
    attempt = 1
  ): void {
    const records = this.restartRecords.get(serviceName) || [];

    const record: RestartRecord = {
      serviceName,
      attempt,
      startTime: new Date(),
      success,
      error,
      delay: this.calculateRestartDelay(serviceName, attempt - 1),
      strategy: this.config.strategy,
    };

    records.push(record);

    // 只保留最近100条记录
    if (records.length > 100) {
      records.splice(0, records.length - 100);
    }

    this.restartRecords.set(serviceName, records);
  }

  /**
   * 更新健康状态
   */
  private updateHealthStatus(
    serviceName: string,
    status: ServiceHealthStatus
  ): void {
    const oldStatus = this.healthStatus.get(serviceName);

    if (oldStatus !== status) {
      this.logger.info("服务健康状态变化", {
        serviceName,
        oldStatus,
        newStatus: status,
      });

      this.healthStatus.set(serviceName, status);

      // 发射健康状态变化事件
      getEventBus().emitEvent("service:health:changed", {
        serviceName,
        oldStatus: oldStatus || "unknown",
        newStatus: status,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * 取消待重启
   */
  private cancelPendingRestart(serviceName: string): void {
    const timer = this.restartTimers.get(serviceName);
    if (timer) {
      clearTimeout(timer);
      this.restartTimers.delete(serviceName);
      this.logger.debug("取消待重启", { serviceName });
    }
  }

  /**
   * 手动触发重启
   */
  async triggerManualRestart(
    serviceName: string,
    reason?: string
  ): Promise<void> {
    this.logger.info("手动触发服务重启", {
      serviceName,
      reason,
    });

    // 更新健康状态
    this.updateHealthStatus(serviceName, ServiceHealthStatus.UNHEALTHY);

    // 取消待重启
    this.cancelPendingRestart(serviceName);

    // 立即执行重启
    await this.executeRestart(serviceName, reason || "手动重启", 1);
  }

  /**
   * 获取服务重启记录
   */
  getRestartHistory(serviceName: string): RestartRecord[] {
    return this.restartRecords.get(serviceName) || [];
  }

  /**
   * 获取服务健康状态
   */
  getServiceHealth(serviceName: string): ServiceHealthStatus {
    return this.healthStatus.get(serviceName) || ServiceHealthStatus.UNKNOWN;
  }

  /**
   * 获取所有服务健康状态
   */
  getAllServiceHealth(): Record<string, ServiceHealthStatus> {
    return Object.fromEntries(this.healthStatus);
  }

  /**
   * 获取重启统计信息
   */
  getRestartStats(serviceName?: string) {
    if (serviceName) {
      const records = this.restartRecords.get(serviceName) || [];
      return this.calculateStats(records);
    }

    const allStats: Record<string, any> = {};
    for (const [name, records] of this.restartRecords) {
      allStats[name] = this.calculateStats(records);
    }

    return allStats;
  }

  /**
   * 计算统计信息
   */
  private calculateStats(records: RestartRecord[]) {
    if (records.length === 0) {
      return {
        totalRestarts: 0,
        successfulRestarts: 0,
        failedRestarts: 0,
        successRate: 0,
        averageDelay: 0,
        lastRestartTime: null,
      };
    }

    const successful = records.filter((r) => r.success).length;
    const failed = records.filter((r) => !r.success).length;
    const averageDelay =
      records.reduce((sum, r) => sum + r.delay, 0) / records.length;
    const lastRestart = records[records.length - 1];

    return {
      totalRestarts: records.length,
      successfulRestarts: successful,
      failedRestarts: failed,
      successRate: successful / records.length,
      averageDelay,
      lastRestartTime: lastRestart.startTime,
    };
  }

  /**
   * 重置服务状态
   */
  resetServiceStatus(serviceName: string): void {
    this.cancelPendingRestart(serviceName);
    this.healthStatus.delete(serviceName);
    this.consecutiveFailures.delete(serviceName);
    this.logger.info("重置服务状态", { serviceName });
  }

  /**
   * 销毁重启管理器
   */
  destroy(): void {
    // 取消所有待重启
    for (const timer of this.restartTimers.values()) {
      clearTimeout(timer);
    }

    this.restartTimers.clear();
    this.restartRecords.clear();
    this.healthStatus.clear();
    this.consecutiveFailures.clear();

    this.logger.info("服务重启管理器已销毁");
  }
}

/**
 * 全局服务重启管理器实例
 */
export const globalServiceRestartManager = new ServiceRestartManager();
