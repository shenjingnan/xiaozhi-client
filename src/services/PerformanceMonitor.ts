import { Logger } from "../Logger.js";

/**
 * 性能指标接口
 */
export interface PerformanceMetrics {
  serviceName: string;
  connectionLatency: number; // 连接延迟（毫秒）
  averageToolCallLatency: number; // 平均工具调用延迟（毫秒）
  toolCallLatencies: Map<string, number[]>; // 每个工具的调用延迟历史
  successRate: number; // 成功率（0-1）
  errorRate: number; // 错误率（0-1）
  totalOperations: number; // 总操作数
  successfulOperations: number; // 成功操作数
  failedOperations: number; // 失败操作数
  lastUpdated: Date; // 最后更新时间
  uptime: number; // 运行时间（毫秒）
  startTime: Date; // 启动时间
}

/**
 * 操作类型枚举
 */
export enum OperationType {
  CONNECTION = "connection",
  TOOL_CALL = "tool_call",
  RECONNECTION = "reconnection",
  HEALTH_CHECK = "health_check",
}

/**
 * 计时器接口
 */
interface Timer {
  id: string;
  operation: string;
  serviceName: string;
  startTime: number;
  type: OperationType;
}

/**
 * 性能监控器
 */
class PerformanceMonitorClass {
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private timers: Map<string, Timer> = new Map();
  private logger: Logger;
  private readonly MAX_LATENCY_HISTORY = 100; // 保留最近100次的延迟记录

  constructor() {
    this.logger = new Logger().withTag("PerformanceMonitor");
  }

  /**
   * 初始化服务的性能指标
   */
  initializeService(serviceName: string): void {
    if (!this.metrics.has(serviceName)) {
      const now = new Date();
      this.metrics.set(serviceName, {
        serviceName,
        connectionLatency: 0,
        averageToolCallLatency: 0,
        toolCallLatencies: new Map(),
        successRate: 1,
        errorRate: 0,
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        lastUpdated: now,
        uptime: 0,
        startTime: now,
      });
      this.logger.debug(`初始化服务 ${serviceName} 的性能指标`);
    }
  }

  /**
   * 开始计时
   */
  startTiming(
    serviceName: string,
    operation: string,
    type: OperationType = OperationType.TOOL_CALL
  ): string {
    const timerId = `${serviceName}-${operation}-${Date.now()}-${Math.random()}`;
    const timer: Timer = {
      id: timerId,
      operation,
      serviceName,
      startTime: performance.now(),
      type,
    };

    this.timers.set(timerId, timer);
    this.logger.debug(`开始计时: ${serviceName} - ${operation} (${timerId})`);

    return timerId;
  }

  /**
   * 结束计时并记录性能数据
   */
  endTiming(timerId: string, success = true): number {
    const timer = this.timers.get(timerId);
    if (!timer) {
      this.logger.warn(`未找到计时器: ${timerId}`);
      return 0;
    }

    const endTime = performance.now();
    const duration = endTime - timer.startTime;

    // 确保服务已初始化
    this.initializeService(timer.serviceName);

    // 记录性能数据
    this.recordPerformance(timer, duration, success);

    // 清理计时器
    this.timers.delete(timerId);

    this.logger.debug(
      `结束计时: ${timer.serviceName} - ${timer.operation} = ${duration.toFixed(2)}ms (${success ? "成功" : "失败"})`
    );

    return duration;
  }

  /**
   * 记录成功操作
   */
  recordSuccess(
    serviceName: string,
    operation: string,
    duration?: number
  ): void {
    this.initializeService(serviceName);
    const metrics = this.metrics.get(serviceName)!;

    metrics.successfulOperations++;
    metrics.totalOperations++;
    this.updateRates(metrics);

    if (duration !== undefined && operation) {
      this.recordToolCallLatency(serviceName, operation, duration);
    }

    metrics.lastUpdated = new Date();
    this.logger.debug(`记录成功操作: ${serviceName} - ${operation}`);
  }

  /**
   * 记录失败操作
   */
  recordError(serviceName: string, operation: string): void {
    this.initializeService(serviceName);
    const metrics = this.metrics.get(serviceName)!;

    metrics.failedOperations++;
    metrics.totalOperations++;
    this.updateRates(metrics);

    metrics.lastUpdated = new Date();
    this.logger.debug(`记录失败操作: ${serviceName} - ${operation}`);
  }

  /**
   * 记录连接延迟
   */
  recordConnectionLatency(serviceName: string, latency: number): void {
    this.initializeService(serviceName);
    const metrics = this.metrics.get(serviceName)!;

    metrics.connectionLatency = latency;
    metrics.lastUpdated = new Date();
    this.logger.debug(`记录连接延迟: ${serviceName} = ${latency.toFixed(2)}ms`);
  }

  /**
   * 获取服务的性能指标
   */
  getMetrics(serviceName: string): PerformanceMetrics | undefined {
    const metrics = this.metrics.get(serviceName);
    if (metrics) {
      // 更新运行时间
      metrics.uptime = Date.now() - metrics.startTime.getTime();
      // 重新计算平均工具调用延迟
      this.updateAverageToolCallLatency(metrics);
    }
    return metrics;
  }

  /**
   * 获取所有服务的性能指标
   */
  getAllMetrics(): Map<string, PerformanceMetrics> {
    const result = new Map<string, PerformanceMetrics>();

    for (const [serviceName, metrics] of this.metrics) {
      // 更新运行时间
      metrics.uptime = Date.now() - metrics.startTime.getTime();
      // 重新计算平均工具调用延迟
      this.updateAverageToolCallLatency(metrics);
      result.set(serviceName, { ...metrics });
    }

    return result;
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): {
    summary: {
      totalServices: number;
      averageSuccessRate: number;
      averageErrorRate: number;
      totalOperations: number;
    };
    services: PerformanceMetrics[];
  } {
    const allMetrics = Array.from(this.getAllMetrics().values());

    const totalOperations = allMetrics.reduce(
      (sum, metrics) => sum + metrics.totalOperations,
      0
    );

    const averageSuccessRate =
      allMetrics.length > 0
        ? allMetrics.reduce((sum, metrics) => sum + metrics.successRate, 0) /
          allMetrics.length
        : 0;

    const averageErrorRate =
      allMetrics.length > 0
        ? allMetrics.reduce((sum, metrics) => sum + metrics.errorRate, 0) /
          allMetrics.length
        : 0;

    return {
      summary: {
        totalServices: allMetrics.length,
        averageSuccessRate,
        averageErrorRate,
        totalOperations,
      },
      services: allMetrics,
    };
  }

  /**
   * 清理服务的性能数据
   */
  clearMetrics(serviceName?: string): void {
    if (serviceName) {
      this.metrics.delete(serviceName);
      // 清理相关的计时器
      for (const [timerId, timer] of this.timers) {
        if (timer.serviceName === serviceName) {
          this.timers.delete(timerId);
        }
      }
      this.logger.info(`已清理服务 ${serviceName} 的性能数据`);
    } else {
      this.metrics.clear();
      this.timers.clear();
      this.logger.info("已清理所有性能数据");
    }
  }

  /**
   * 记录性能数据（私有方法）
   */
  private recordPerformance(
    timer: Timer,
    duration: number,
    success: boolean
  ): void {
    const metrics = this.metrics.get(timer.serviceName)!;

    // 根据操作类型记录不同的指标
    switch (timer.type) {
      case OperationType.CONNECTION:
        metrics.connectionLatency = duration;
        break;
      case OperationType.TOOL_CALL:
        this.recordToolCallLatency(
          timer.serviceName,
          timer.operation,
          duration
        );
        break;
    }

    // 更新操作统计
    metrics.totalOperations++;
    if (success) {
      metrics.successfulOperations++;
    } else {
      metrics.failedOperations++;
    }

    this.updateRates(metrics);
    metrics.lastUpdated = new Date();
  }

  /**
   * 记录工具调用延迟
   */
  private recordToolCallLatency(
    serviceName: string,
    toolName: string,
    latency: number
  ): void {
    const metrics = this.metrics.get(serviceName)!;

    if (!metrics.toolCallLatencies.has(toolName)) {
      metrics.toolCallLatencies.set(toolName, []);
    }

    const latencies = metrics.toolCallLatencies.get(toolName)!;
    latencies.push(latency);

    // 限制历史记录数量
    if (latencies.length > this.MAX_LATENCY_HISTORY) {
      latencies.shift();
    }

    this.updateAverageToolCallLatency(metrics);
  }

  /**
   * 更新成功率和错误率
   */
  private updateRates(metrics: PerformanceMetrics): void {
    if (metrics.totalOperations > 0) {
      metrics.successRate =
        metrics.successfulOperations / metrics.totalOperations;
      metrics.errorRate = metrics.failedOperations / metrics.totalOperations;
    } else {
      metrics.successRate = 1;
      metrics.errorRate = 0;
    }
  }

  /**
   * 更新平均工具调用延迟
   */
  private updateAverageToolCallLatency(metrics: PerformanceMetrics): void {
    let totalLatency = 0;
    let totalCalls = 0;

    for (const latencies of metrics.toolCallLatencies.values()) {
      totalLatency += latencies.reduce((sum, latency) => sum + latency, 0);
      totalCalls += latencies.length;
    }

    metrics.averageToolCallLatency =
      totalCalls > 0 ? totalLatency / totalCalls : 0;
  }
}

// 导出单例实例
let performanceMonitorInstance: PerformanceMonitorClass | null = null;

export const PerformanceMonitor = (() => {
  if (!performanceMonitorInstance) {
    performanceMonitorInstance = new PerformanceMonitorClass();
  }
  return performanceMonitorInstance;
})();

// 导出类型和枚举
export { PerformanceMonitorClass };
