import type { Logger } from "../Logger.js";
import { logger } from "../Logger.js";
import type { MCPService } from "./MCPService.js";
import type { MCPServiceManager } from "./MCPServiceManager.js";
import { PerformanceMonitor } from "./PerformanceMonitor.js";

/**
 * 健康状态接口
 */
export interface HealthStatus {
  serviceName: string;
  healthy: boolean;
  lastCheck: Date;
  issues: string[];
  uptime: number; // 运行时间（毫秒）
  responseTime: number; // 响应时间（毫秒）
  connectionStable: boolean; // 连接是否稳定
  errorRate: number; // 错误率
  lastError?: string; // 最后一个错误
}

/**
 * 健康检查配置
 */
export interface HealthCheckConfig {
  interval: number; // 检查间隔（毫秒）
  timeout: number; // 检查超时（毫秒）
  maxErrorRate: number; // 最大错误率阈值
  maxResponseTime: number; // 最大响应时间阈值（毫秒）
  retryAttempts: number; // 重试次数
  autoRecover: boolean; // 是否自动恢复
}

/**
 * 健康报告接口
 */
export interface HealthReport {
  timestamp: Date;
  overallHealth: boolean;
  totalServices: number;
  healthyServices: number;
  unhealthyServices: number;
  services: HealthStatus[];
  summary: {
    averageResponseTime: number;
    averageErrorRate: number;
    totalIssues: number;
  };
}

/**
 * 健康检查器
 */
class HealthCheckerClass {
  private logger: Logger;
  private config: HealthCheckConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private healthHistory: Map<string, HealthStatus[]> = new Map();
  private readonly MAX_HISTORY = 50; // 保留最近50次检查记录

  constructor(config?: Partial<HealthCheckConfig>) {
    this.logger = logger;
    this.config = {
      interval: 30000, // 30秒
      timeout: 5000, // 5秒
      maxErrorRate: 0.1, // 10%
      maxResponseTime: 2000, // 2秒
      retryAttempts: 3,
      autoRecover: true,
      ...config,
    };
  }

  /**
   * 检查单个服务的健康状态
   */
  async checkService(service: MCPService): Promise<HealthStatus> {
    const serviceName = service.getConfig().name;
    const startTime = performance.now();

    this.logger.debug(`[HealthChecker] 开始健康检查: ${serviceName}`);

    const status: HealthStatus = {
      serviceName,
      healthy: true,
      lastCheck: new Date(),
      issues: [],
      uptime: 0,
      responseTime: 0,
      connectionStable: false,
      errorRate: 0,
      lastError: undefined,
    };

    try {
      // 检查连接状态
      const isConnected = service.isConnected();
      if (!isConnected) {
        status.healthy = false;
        status.issues.push("服务未连接");
      } else {
        status.connectionStable = true;
      }

      // 获取性能指标
      const metrics = PerformanceMonitor.getMetrics(serviceName);
      if (metrics) {
        status.uptime = metrics.uptime;
        status.errorRate = metrics.errorRate;
        status.responseTime = metrics.averageToolCallLatency;

        // 检查错误率
        if (metrics.errorRate > this.config.maxErrorRate) {
          status.healthy = false;
          status.issues.push(
            `错误率过高: ${(metrics.errorRate * 100).toFixed(1)}%`
          );
        }

        // 检查响应时间
        if (metrics.averageToolCallLatency > this.config.maxResponseTime) {
          status.healthy = false;
          status.issues.push(
            `响应时间过长: ${metrics.averageToolCallLatency.toFixed(0)}ms`
          );
        }
      }

      // 执行简单的健康检查（获取工具列表）
      try {
        const tools = service.getTools();
        const checkEndTime = performance.now();
        status.responseTime = checkEndTime - startTime;

        if (tools.length === 0 && isConnected) {
          status.healthy = false;
          status.issues.push("未发现可用工具");
        }
      } catch (error) {
        const checkEndTime = performance.now();
        status.responseTime = checkEndTime - startTime;
        status.healthy = false;
        status.issues.push(`工具检查失败: ${(error as Error).message}`);
        status.lastError = (error as Error).message;
      }

      // 记录健康检查历史
      this.recordHealthHistory(serviceName, status);

      this.logger.debug(
        `[HealthChecker] 健康检查完成: ${serviceName} - ${status.healthy ? "健康" : "不健康"} (${status.responseTime.toFixed(0)}ms)`
      );

      return status;
    } catch (error) {
      const checkEndTime = performance.now();
      status.responseTime = checkEndTime - startTime;
      status.healthy = false;
      status.issues.push(`健康检查异常: ${(error as Error).message}`);
      status.lastError = (error as Error).message;

      this.recordHealthHistory(serviceName, status);
      this.logger.error(`[HealthChecker] 健康检查异常: ${serviceName}`, error);

      return status;
    }
  }

  /**
   * 检查所有服务的健康状态
   */
  async checkAllServices(
    manager: MCPServiceManager
  ): Promise<Map<string, HealthStatus>> {
    const results = new Map<string, HealthStatus>();
    const services = manager.getAllServices();

    this.logger.debug(
      `[HealthChecker] 开始检查 ${services.size} 个服务的健康状态`
    );

    // 并行检查所有服务
    const checkPromises = Array.from(services.entries()).map(
      async ([serviceName, service]: [string, MCPService]) => {
        try {
          const status = await this.checkService(service);
          results.set(serviceName, status);

          // 如果启用自动恢复且服务不健康，尝试恢复
          if (!status.healthy && this.config.autoRecover) {
            await this.attemptRecovery(service, status);
          }
        } catch (error) {
          this.logger.error(
            `[HealthChecker] 检查服务 ${serviceName} 时发生错误:`,
            error
          );
          results.set(serviceName, {
            serviceName,
            healthy: false,
            lastCheck: new Date(),
            issues: [`检查失败: ${(error as Error).message}`],
            uptime: 0,
            responseTime: 0,
            connectionStable: false,
            errorRate: 1,
            lastError: (error as Error).message,
          });
        }
      }
    );

    await Promise.all(checkPromises);

    this.logger.info(
      `[HealthChecker] 健康检查完成: ${results.size} 个服务，${Array.from(results.values()).filter((s) => s.healthy).length} 个健康`
    );

    return results;
  }

  /**
   * 开始定期健康检查
   */
  startPeriodicCheck(manager: MCPServiceManager): void {
    if (this.intervalId) {
      this.logger.warn("[HealthChecker] 定期健康检查已在运行");
      return;
    }

    this.logger.info(
      `[HealthChecker] 开始定期健康检查，间隔: ${this.config.interval}ms`
    );

    this.intervalId = setInterval(async () => {
      try {
        await this.checkAllServices(manager);
      } catch (error) {
        this.logger.error("[HealthChecker] 定期健康检查失败:", error);
      }
    }, this.config.interval);
  }

  /**
   * 停止定期健康检查
   */
  stopPeriodicCheck(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.info("[HealthChecker] 已停止定期健康检查");
    }
  }

  /**
   * 获取健康报告
   */
  getHealthReport(healthStatuses: Map<string, HealthStatus>): HealthReport {
    const services = Array.from(healthStatuses.values());
    const healthyServices = services.filter((s) => s.healthy);
    const unhealthyServices = services.filter((s) => !s.healthy);

    const totalResponseTime = services.reduce(
      (sum, s) => sum + s.responseTime,
      0
    );
    const totalErrorRate = services.reduce((sum, s) => sum + s.errorRate, 0);
    const totalIssues = services.reduce((sum, s) => sum + s.issues.length, 0);

    return {
      timestamp: new Date(),
      overallHealth: unhealthyServices.length === 0,
      totalServices: services.length,
      healthyServices: healthyServices.length,
      unhealthyServices: unhealthyServices.length,
      services,
      summary: {
        averageResponseTime:
          services.length > 0 ? totalResponseTime / services.length : 0,
        averageErrorRate:
          services.length > 0 ? totalErrorRate / services.length : 0,
        totalIssues,
      },
    };
  }

  /**
   * 获取服务的健康历史
   */
  getHealthHistory(serviceName: string): HealthStatus[] {
    return this.healthHistory.get(serviceName) || [];
  }

  /**
   * 清理健康历史
   */
  clearHealthHistory(serviceName?: string): void {
    if (serviceName) {
      this.healthHistory.delete(serviceName);
      this.logger.info(`[HealthChecker] 已清理服务 ${serviceName} 的健康历史`);
    } else {
      this.healthHistory.clear();
      this.logger.info("[HealthChecker] 已清理所有健康历史");
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<HealthCheckConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info("[HealthChecker] 健康检查配置已更新");
  }

  /**
   * 获取当前配置
   */
  getConfig(): HealthCheckConfig {
    return { ...this.config };
  }

  /**
   * 记录健康检查历史
   */
  private recordHealthHistory(serviceName: string, status: HealthStatus): void {
    if (!this.healthHistory.has(serviceName)) {
      this.healthHistory.set(serviceName, []);
    }

    const history = this.healthHistory.get(serviceName)!;
    history.push({ ...status });

    // 限制历史记录数量
    if (history.length > this.MAX_HISTORY) {
      history.shift();
    }
  }

  /**
   * 尝试恢复不健康的服务
   */
  private async attemptRecovery(
    service: MCPService,
    status: HealthStatus
  ): Promise<void> {
    const serviceName = status.serviceName;
    this.logger.info(`[HealthChecker] 尝试恢复不健康的服务: ${serviceName}`);

    try {
      // 如果服务未连接，尝试重新连接
      if (!service.isConnected()) {
        this.logger.info(`[HealthChecker] 尝试重新连接服务: ${serviceName}`);
        await service.reconnect();

        // 等待一段时间让连接稳定
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // 重新检查状态
        const newStatus = await this.checkService(service);
        if (newStatus.healthy) {
          this.logger.info(`[HealthChecker] 服务 ${serviceName} 恢复成功`);
        } else {
          this.logger.warn(`[HealthChecker] 服务 ${serviceName} 恢复失败`);
        }
      }
    } catch (error) {
      this.logger.error(
        `[HealthChecker] 恢复服务 ${serviceName} 时发生错误:`,
        error
      );
    }
  }
}

// 导出单例实例
let healthCheckerInstance: HealthCheckerClass | null = null;

export const HealthChecker = (() => {
  if (!healthCheckerInstance) {
    healthCheckerInstance = new HealthCheckerClass();
  }
  return healthCheckerInstance;
})();

// 导出类型和类
export { HealthCheckerClass };
