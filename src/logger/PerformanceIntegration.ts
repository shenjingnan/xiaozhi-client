import { Logger } from "../logger.js";
import {
  OperationType,
  type PerformanceMetrics,
  PerformanceMonitor,
} from "../services/PerformanceMonitor.js";
import { LogContext } from "./LogContext.js";
import { StructuredLogger } from "./StructuredLogger.js";

export interface PerformanceConfig {
  enabled: boolean;
  slowOperationThreshold: number; // 慢操作阈值（毫秒）
  memoryMonitoringEnabled: boolean;
  cpuMonitoringEnabled: boolean;
  autoLogSlowOperations: boolean;
  performanceLogLevel: "debug" | "info" | "warn";
  metricsCollectionInterval: number; // 指标收集间隔（毫秒）
}

export interface SystemMetrics {
  memoryUsage: {
    rss: number; // 常驻内存大小
    heapTotal: number; // 堆总大小
    heapUsed: number; // 已使用堆大小
    external: number; // 外部内存使用
    arrayBuffers: number; // ArrayBuffer 内存使用
  };
  cpuUsage: {
    user: number; // 用户CPU时间
    system: number; // 系统CPU时间
  };
  uptime: number; // 进程运行时间
  timestamp: Date;
}

export interface PerformanceLogData {
  operation: string;
  duration: number;
  success: boolean;
  serviceName?: string;
  operationType: string;
  threshold?: number;
  isSlowOperation: boolean;
  systemMetrics?: SystemMetrics;
  customMetrics?: Record<string, any>;
}

export class PerformanceIntegration {
  private static instance: PerformanceIntegration;
  private performanceMonitor: typeof PerformanceMonitor;
  private logContext: LogContext;
  private structuredLogger: StructuredLogger;
  private logger: Logger;
  private config: PerformanceConfig;
  private metricsInterval?: NodeJS.Timeout;
  private lastCpuUsage?: NodeJS.CpuUsage;

  private constructor(config?: Partial<PerformanceConfig>) {
    this.performanceMonitor = PerformanceMonitor;
    this.logContext = LogContext.getInstance();
    this.structuredLogger = new StructuredLogger();
    this.logger = new Logger().withTag("PerformanceIntegration");
    this.config = {
      enabled: true,
      slowOperationThreshold: 1000, // 1秒
      memoryMonitoringEnabled: true,
      cpuMonitoringEnabled: true,
      autoLogSlowOperations: true,
      performanceLogLevel: "info",
      metricsCollectionInterval: 60000, // 1分钟
      ...config,
    };

    this.initializePerformanceTemplates();
    this.startMetricsCollection();
  }

  static getInstance(
    config?: Partial<PerformanceConfig>
  ): PerformanceIntegration {
    if (!PerformanceIntegration.instance) {
      PerformanceIntegration.instance = new PerformanceIntegration(config);
    }
    return PerformanceIntegration.instance;
  }

  private initializePerformanceTemplates(): void {
    // 性能日志模板
    this.structuredLogger.registerTemplate({
      name: "performance_operation",
      level: this.config.performanceLogLevel,
      description: "操作性能日志模板",
      fields: [
        { name: "operation", type: "string", required: true },
        { name: "duration", type: "number", required: true },
        { name: "success", type: "boolean", required: true },
        { name: "serviceName", type: "string" },
        { name: "operationType", type: "string", required: true },
        { name: "threshold", type: "number" },
        { name: "isSlowOperation", type: "boolean", required: true },
        { name: "systemMetrics", type: "object" },
        { name: "customMetrics", type: "object" },
        { name: "timestamp", type: "date", required: true },
      ],
    });

    // 系统指标日志模板
    this.structuredLogger.registerTemplate({
      name: "system_metrics",
      level: "info",
      description: "系统指标日志模板",
      fields: [
        { name: "memoryUsage", type: "object", required: true },
        { name: "cpuUsage", type: "object" },
        { name: "uptime", type: "number", required: true },
        { name: "timestamp", type: "date", required: true },
      ],
    });

    // 慢操作警告日志模板
    this.structuredLogger.registerTemplate({
      name: "slow_operation_warning",
      level: "warn",
      description: "慢操作警告日志模板",
      fields: [
        { name: "operation", type: "string", required: true },
        { name: "duration", type: "number", required: true },
        { name: "threshold", type: "number", required: true },
        { name: "serviceName", type: "string" },
        { name: "operationType", type: "string", required: true },
        { name: "impact", type: "string" },
        { name: "recommendations", type: "array" },
        { name: "timestamp", type: "date", required: true },
      ],
    });
  }

  // 开始性能监控
  startTiming(
    serviceName: string,
    operation: string,
    type: OperationType = OperationType.TOOL_CALL,
    customMetrics?: Record<string, any>
  ): string {
    if (!this.config.enabled) {
      return "";
    }

    // 在上下文中记录操作开始
    this.logContext.setBusinessContext({
      operation,
      module: serviceName,
      metadata: {
        operationType: type,
        startTime: new Date(),
        ...customMetrics,
      },
    });

    return this.performanceMonitor.startTiming(serviceName, operation, type);
  }

  // 结束性能监控并记录日志
  endTiming(
    timerId: string,
    success = true,
    customMetrics?: Record<string, any>
  ): number {
    if (!this.config.enabled || !timerId) {
      return 0;
    }

    const duration = this.performanceMonitor.endTiming(timerId, success);

    // 获取当前上下文信息
    const contextInfo = this.logContext.getContextForLogging() || {};
    const operation = contextInfo.operation || "unknown";
    const serviceName = contextInfo.module || "unknown";
    const operationType = contextInfo.custom?.operationType || "unknown";

    // 判断是否为慢操作
    const isSlowOperation = duration > this.config.slowOperationThreshold;

    // 收集系统指标
    const systemMetrics = this.collectSystemMetrics();

    // 创建性能日志数据
    const performanceData: PerformanceLogData = {
      operation,
      duration,
      success,
      serviceName,
      operationType,
      threshold: this.config.slowOperationThreshold,
      isSlowOperation,
      systemMetrics:
        this.config.memoryMonitoringEnabled || this.config.cpuMonitoringEnabled
          ? systemMetrics
          : undefined,
      customMetrics,
    };

    // 记录性能日志
    this.logPerformanceData(performanceData);

    // 如果是慢操作且启用了自动日志记录，记录警告
    if (isSlowOperation && this.config.autoLogSlowOperations) {
      this.logSlowOperationWarning(performanceData);
    }

    return duration;
  }

  // 记录性能数据日志
  private logPerformanceData(data: PerformanceLogData): void {
    const logData = this.structuredLogger.createPerformanceLog(
      data.operation,
      data.duration,
      {
        success: data.success,
        serviceName: data.serviceName,
        operationType: data.operationType,
        threshold: data.threshold,
        isSlowOperation: data.isSlowOperation,
        systemMetrics: data.systemMetrics,
        customMetrics: data.customMetrics,
      }
    );

    const result = this.structuredLogger.formatStructuredData(
      "performance_operation",
      {
        ...logData,
        timestamp: new Date(),
      }
    );

    if (result.success && result.data) {
      const logData = {
        template: "performance_operation",
        ...result.data,
        ...this.logContext.getContextForLogging(),
      };

      // 使用实际的日志系统输出
      switch (this.config.performanceLogLevel) {
        case "debug":
          this.logger.debug("Performance operation logged", logData);
          break;
        case "info":
          this.logger.info("Performance operation logged", logData);
          break;
        case "warn":
          this.logger.warn("Performance operation logged", logData);
          break;
      }
    }
  }

  // 记录慢操作警告
  private logSlowOperationWarning(data: PerformanceLogData): void {
    const impact = this.assessPerformanceImpact(data.duration, data.threshold!);
    const recommendations = this.generateRecommendations(data);

    const warningData = {
      operation: data.operation,
      duration: data.duration,
      threshold: data.threshold!,
      serviceName: data.serviceName,
      operationType: data.operationType,
      impact,
      recommendations,
      timestamp: new Date(),
    };

    const result = this.structuredLogger.formatStructuredData(
      "slow_operation_warning",
      warningData
    );

    if (result.success && result.data) {
      const logData = {
        template: "slow_operation_warning",
        ...result.data,
        ...this.logContext.getContextForLogging(),
      };

      this.logger.warn("Slow operation detected", logData);
    }
  }

  // 评估性能影响
  private assessPerformanceImpact(duration: number, threshold: number): string {
    const ratio = duration / threshold;
    if (ratio < 2) return "low";
    if (ratio < 5) return "medium";
    if (ratio < 10) return "high";
    return "critical";
  }

  // 生成优化建议
  private generateRecommendations(data: PerformanceLogData): string[] {
    const recommendations: string[] = [];

    if (data.duration > 5000) {
      recommendations.push("考虑将长时间运行的操作分解为更小的任务");
    }

    if (data.operationType === "tool_call") {
      recommendations.push("检查工具调用的网络延迟和响应时间");
    }

    if (
      data.systemMetrics?.memoryUsage.heapUsed &&
      data.systemMetrics.memoryUsage.heapUsed >
        data.systemMetrics.memoryUsage.heapTotal * 0.8
    ) {
      recommendations.push("内存使用率过高，考虑优化内存管理");
    }

    recommendations.push("启用详细的性能分析以识别瓶颈");

    return recommendations;
  }

  // 收集系统指标
  private collectSystemMetrics(): SystemMetrics {
    const memoryUsage = process.memoryUsage();
    const currentCpuUsage = process.cpuUsage(this.lastCpuUsage);
    this.lastCpuUsage = process.cpuUsage();

    return {
      memoryUsage,
      cpuUsage: {
        user: currentCpuUsage.user / 1000, // 转换为毫秒
        system: currentCpuUsage.system / 1000,
      },
      uptime: process.uptime() * 1000, // 转换为毫秒
      timestamp: new Date(),
    };
  }

  // 开始定期收集指标
  private startMetricsCollection(): void {
    if (!this.config.enabled || this.metricsInterval) {
      return;
    }

    this.metricsInterval = setInterval(() => {
      this.collectAndLogSystemMetrics();
    }, this.config.metricsCollectionInterval);
  }

  // 收集并记录系统指标
  private collectAndLogSystemMetrics(): void {
    const systemMetrics = this.collectSystemMetrics();

    const result = this.structuredLogger.formatStructuredData(
      "system_metrics",
      systemMetrics
    );

    if (result.success && result.data) {
      const logData = {
        template: "system_metrics",
        ...result.data,
        ...this.logContext.getContextForLogging(),
      };

      this.logger.info("System metrics collected", logData);
    }
  }

  // 获取性能指标
  getMetrics(serviceName?: string): PerformanceMetrics | PerformanceMetrics[] {
    if (serviceName) {
      const metrics = this.performanceMonitor.getMetrics(serviceName);
      return metrics || ({} as PerformanceMetrics);
    }
    const allMetrics = this.performanceMonitor.getAllMetrics();
    return Array.from(allMetrics.values());
  }

  // 更新配置
  updateConfig(config: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...config };

    if (!this.config.enabled && this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    } else if (this.config.enabled && !this.metricsInterval) {
      this.startMetricsCollection();
    }
  }

  // 停止监控
  stop(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }
  }

  // 便捷方法：测量函数执行时间
  async measureAsync<T>(
    serviceName: string,
    operation: string,
    fn: () => Promise<T>,
    customMetrics?: Record<string, any>
  ): Promise<T> {
    const timerId = this.startTiming(
      serviceName,
      operation,
      OperationType.TOOL_CALL,
      customMetrics
    );

    try {
      const result = await fn();
      this.endTiming(timerId, true, customMetrics);
      return result;
    } catch (error) {
      this.endTiming(timerId, false, {
        error: error instanceof Error ? error.message : String(error),
        ...customMetrics,
      });
      throw error;
    }
  }

  // 便捷方法：测量同步函数执行时间
  measure<T>(
    serviceName: string,
    operation: string,
    fn: () => T,
    customMetrics?: Record<string, any>
  ): T {
    const timerId = this.startTiming(
      serviceName,
      operation,
      OperationType.TOOL_CALL,
      customMetrics
    );

    try {
      const result = fn();
      this.endTiming(timerId, true, customMetrics);
      return result;
    } catch (error) {
      this.endTiming(timerId, false, {
        error: error instanceof Error ? error.message : String(error),
        ...customMetrics,
      });
      throw error;
    }
  }
}
