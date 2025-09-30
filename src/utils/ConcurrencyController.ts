#!/usr/bin/env node

/**
 * 并发操作控制器
 * 用于管理MCP服务的并发操作，防止竞态条件和资源冲突
 */

import { logger } from "../Logger.js";
import {
  ErrorCategory,
  ErrorSeverity,
  MCPError,
  MCPErrorCode,
} from "../errors/MCPErrors.js";

/**
 * 操作类型枚举
 */
export enum OperationType {
  ADD_SERVER = "add_server",
  REMOVE_SERVER = "remove_server",
  START_SERVICE = "start_service",
  STOP_SERVICE = "stop_service",
  UPDATE_CONFIG = "update_config",
  SYNC_TOOLS = "sync_tools",
  STATUS_CHECK = "status_check",
}

/**
 * 操作状态枚举
 */
export enum OperationStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

/**
 * 操作优先级
 */
export enum OperationPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4,
}

/**
 * 操作队列项接口
 */
export interface OperationQueueItem {
  id: string;
  type: OperationType;
  target: string; // 目标服务器名称
  priority: OperationPriority;
  status: OperationStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: Error;
  result?: any;
  timeout: number; // 超时时间（毫秒）
  executor: () => Promise<any>;
  context?: Record<string, any>;
}

/**
 * 并发控制器配置接口
 */
export interface ConcurrencyControllerConfig {
  maxConcurrentOperations: number;
  maxOperationsPerTarget: number;
  defaultTimeout: number;
  enablePriority: boolean;
  enableRetry: boolean;
  maxRetries: number;
  retryDelay: number;
}

/**
 * 并发操作控制器
 */
export class ConcurrencyController {
  private logger;
  private config: ConcurrencyControllerConfig;
  private operationQueue: OperationQueueItem[] = [];
  private runningOperations: Map<string, OperationQueueItem> = new Map();
  private targetOperationCounts: Map<string, number> = new Map();
  private operationIdCounter = 0;
  private isProcessing = false;

  constructor(config: Partial<ConcurrencyControllerConfig> = {}) {
    this.config = {
      maxConcurrentOperations: 5,
      maxOperationsPerTarget: 2,
      defaultTimeout: 30000, // 30秒
      enablePriority: true,
      enableRetry: true,
      maxRetries: 3,
      retryDelay: 1000,
      ...config,
    };
    this.logger = logger.withTag("ConcurrencyController");
    this.startProcessing();
  }

  /**
   * 添加操作到队列
   */
  async addOperation<T = any>(
    type: OperationType,
    target: string,
    executor: () => Promise<T>,
    options: {
      priority?: OperationPriority;
      timeout?: number;
      context?: Record<string, any>;
    } = {}
  ): Promise<T> {
    const operationId = `op_${++this.operationIdCounter}_${Date.now()}`;

    const operation: OperationQueueItem = {
      id: operationId,
      type,
      target,
      priority: options.priority || OperationPriority.NORMAL,
      status: OperationStatus.PENDING,
      createdAt: new Date(),
      timeout: options.timeout || this.config.defaultTimeout,
      executor,
      context: options.context,
    };

    this.logger.debug("添加操作到队列", {
      operationId,
      type,
      target,
      priority: operation.priority,
    });

    return new Promise((resolve, reject) => {
      // 包装执行器，使其返回Promise
      const wrappedExecutor = async () => {
        try {
          const result = await executor();
          resolve(result);
          return result;
        } catch (error) {
          reject(error);
          throw error;
        }
      };

      operation.executor = wrappedExecutor;

      // 插入到队列中的合适位置（基于优先级）
      this.insertOperationByPriority(operation);

      // 触发处理
      this.processQueue();
    });
  }

  /**
   * 按优先级插入操作
   */
  private insertOperationByPriority(operation: OperationQueueItem): void {
    if (!this.config.enablePriority) {
      this.operationQueue.push(operation);
      return;
    }

    // 找到插入位置（从高到低优先级）
    let insertIndex = 0;
    for (let i = 0; i < this.operationQueue.length; i++) {
      if (this.operationQueue[i].priority <= operation.priority) {
        insertIndex = i;
        break;
      }
      insertIndex = i + 1;
    }

    this.operationQueue.splice(insertIndex, 0, operation);
  }

  /**
   * 开始处理队列
   */
  private startProcessing(): void {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.logger.info("并发控制器已启动");
  }

  /**
   * 处理队列
   */
  private async processQueue(): Promise<void> {
    if (!this.isProcessing) {
      return;
    }

    // 清理已完成的操作
    this.cleanupCompletedOperations();

    // 检查是否可以执行新操作
    while (this.canExecuteNextOperation()) {
      const operation = this.operationQueue.shift();
      if (!operation) {
        break;
      }

      this.executeOperation(operation);
    }
  }

  /**
   * 检查是否可以执行下一个操作
   */
  private canExecuteNextOperation(): boolean {
    // 检查并发操作总数限制
    if (this.runningOperations.size >= this.config.maxConcurrentOperations) {
      return false;
    }

    // 检查队列是否为空
    if (this.operationQueue.length === 0) {
      return false;
    }

    // 检查下一个操作的目标是否已达到限制
    const nextOperation = this.operationQueue[0];
    const targetCount =
      this.targetOperationCounts.get(nextOperation.target) || 0;

    return targetCount < this.config.maxOperationsPerTarget;
  }

  /**
   * 执行操作
   */
  private async executeOperation(operation: OperationQueueItem): Promise<void> {
    operation.status = OperationStatus.RUNNING;
    operation.startedAt = new Date();

    this.runningOperations.set(operation.id, operation);
    this.incrementTargetCount(operation.target);

    this.logger.info("开始执行操作", {
      operationId: operation.id,
      type: operation.type,
      target: operation.target,
      priority: operation.priority,
    });

    try {
      // 设置超时
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(
            new MCPError(
              MCPErrorCode.CONNECTION_TIMEOUT,
              `操作超时: ${operation.type} - ${operation.target}`,
              ErrorSeverity.HIGH,
              ErrorCategory.OPERATION
            )
          );
        }, operation.timeout);
      });

      // 执行操作
      const result = await Promise.race([operation.executor(), timeoutPromise]);

      operation.status = OperationStatus.COMPLETED;
      operation.completedAt = new Date();
      operation.result = result;

      this.logger.info("操作执行成功", {
        operationId: operation.id,
        type: operation.type,
        target: operation.target,
        duration:
          operation.completedAt.getTime() - operation.startedAt!.getTime(),
      });
    } catch (error) {
      operation.status = OperationStatus.FAILED;
      operation.completedAt = new Date();
      operation.error =
        error instanceof Error ? error : new Error(String(error));

      this.logger.error(
        "操作执行失败",
        {
          operationId: operation.id,
          error: error instanceof MCPError ? error : MCPError.fromError(error as Error),
          type: operation.type,
          target: operation.target,
          phase: "execution",
        }
      );

      // 如果启用了重试且还有重试次数
      if (this.config.enableRetry && this.shouldRetry(operation)) {
        await this.retryOperation(operation);
      }
    } finally {
      this.runningOperations.delete(operation.id);
      this.decrementTargetCount(operation.target);

      // 继续处理队列
      setImmediate(() => this.processQueue());
    }
  }

  /**
   * 检查是否应该重试
   */
  private shouldRetry(operation: OperationQueueItem): boolean {
    const retryCount = operation.context?.retryCount || 0;
    return retryCount < this.config.maxRetries;
  }

  /**
   * 重试操作
   */
  private async retryOperation(operation: OperationQueueItem): Promise<void> {
    const retryCount = (operation.context?.retryCount || 0) + 1;

    this.logger.info("重试操作", {
      operationId: operation.id,
      type: operation.type,
      target: operation.target,
      retryCount,
      maxRetries: this.config.maxRetries,
    });

    // 创建重试操作
    const retryOperation: OperationQueueItem = {
      ...operation,
      id: `op_${++this.operationIdCounter}_${Date.now()}_retry_${retryCount}`,
      status: OperationStatus.PENDING,
      createdAt: new Date(),
      startedAt: undefined,
      completedAt: undefined,
      error: undefined,
      result: undefined,
      context: {
        ...operation.context,
        retryCount,
        originalOperationId: operation.id,
      },
    };

    // 添加到队列前面（高优先级）
    retryOperation.priority = OperationPriority.HIGH;
    this.insertOperationByPriority(retryOperation);

    // 延迟处理
    setTimeout(() => this.processQueue(), this.config.retryDelay);
  }

  /**
   * 清理已完成的操作
   */
  private cleanupCompletedOperations(): void {
    const now = Date.now();
    const cleanupThreshold = 5 * 60 * 1000; // 5分钟

    for (const [id, operation] of this.runningOperations) {
      if (
        operation.status === OperationStatus.COMPLETED ||
        operation.status === OperationStatus.FAILED
      ) {
        const completedTime = operation.completedAt?.getTime() || 0;
        if (now - completedTime > cleanupThreshold) {
          this.runningOperations.delete(id);
        }
      }
    }
  }

  /**
   * 增加目标操作计数
   */
  private incrementTargetCount(target: string): void {
    const count = this.targetOperationCounts.get(target) || 0;
    this.targetOperationCounts.set(target, count + 1);
  }

  /**
   * 减少目标操作计数
   */
  private decrementTargetCount(target: string): void {
    const count = this.targetOperationCounts.get(target) || 0;
    if (count <= 1) {
      this.targetOperationCounts.delete(target);
    } else {
      this.targetOperationCounts.set(target, count - 1);
    }
  }

  /**
   * 获取队列状态
   */
  getStatus() {
    return {
      isProcessing: this.isProcessing,
      queueLength: this.operationQueue.length,
      runningOperations: this.runningOperations.size,
      targetOperationCounts: Object.fromEntries(this.targetOperationCounts),
      config: this.config,
    };
  }

  /**
   * 取消特定目标的操作
   */
  cancelTargetOperations(target: string): number {
    let cancelledCount = 0;

    // 取消队列中的操作
    this.operationQueue = this.operationQueue.filter((operation) => {
      if (
        operation.target === target &&
        operation.status === OperationStatus.PENDING
      ) {
        operation.status = OperationStatus.CANCELLED;
        operation.completedAt = new Date();
        cancelledCount++;
        return false;
      }
      return true;
    });

    this.logger.info("取消目标操作", { target, cancelledCount });
    return cancelledCount;
  }

  /**
   * 销毁控制器
   */
  destroy(): void {
    this.isProcessing = false;
    this.operationQueue = [];
    this.runningOperations.clear();
    this.targetOperationCounts.clear();
    this.logger.info("并发控制器已销毁");
  }
}

/**
 * 全局并发控制器实例
 */
export const globalConcurrencyController = new ConcurrencyController();
