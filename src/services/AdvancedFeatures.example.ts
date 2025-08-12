#!/usr/bin/env node

/**
 * 高级功能使用示例
 * 展示如何使用错误处理、性能监控、健康检查和配置热重载功能
 */

import { Logger } from "../logger.js";
import { ConfigChangeType, ConfigWatcher } from "./ConfigWatcher.js";
import {
  categorizeError,
  formatUserFriendlyMessage,
  shouldAlert,
} from "./ErrorHandler.js";
import { HealthChecker } from "./HealthChecker.js";
import type { MCPServiceConfig } from "./MCPService.js";
import MCPServiceManager from "./MCPServiceManager.js";
import { OperationType, PerformanceMonitor } from "./PerformanceMonitor.js";

const logger = new Logger().withTag("AdvancedFeaturesExample");

/**
 * 高级功能演示类
 */
class AdvancedFeaturesDemo {
  private serviceManager: MCPServiceManager;
  private configPath: string;

  constructor(configPath = "./xiaozhi.config.json") {
    this.serviceManager = new MCPServiceManager();
    this.configPath = configPath;
  }

  /**
   * 演示错误处理功能
   */
  async demonstrateErrorHandling(): Promise<void> {
    logger.info("=== 错误处理功能演示 ===");

    // 模拟各种类型的错误
    const errors = [
      new Error("Connection refused"),
      new Error("Tool method not found"),
      new Error("Request timed out"),
      new Error("Unauthorized access"),
      new Error("Invalid configuration"),
    ];

    for (const error of errors) {
      const mcpError = categorizeError(error, "demo-service");
      const userMessage = formatUserFriendlyMessage(mcpError);
      const needsAlert = shouldAlert(mcpError);

      logger.info(`错误: ${error.message}`);
      logger.info(`分类: ${mcpError.category} (${mcpError.code})`);
      logger.info(`可恢复: ${mcpError.recoverable ? "是" : "否"}`);
      logger.info(`恢复策略: ${mcpError.recoveryStrategy}`);
      logger.info(`用户消息: ${userMessage}`);
      logger.info(`需要告警: ${needsAlert ? "是" : "否"}`);
      logger.info("---");
    }
  }

  /**
   * 演示性能监控功能
   */
  async demonstratePerformanceMonitoring(): Promise<void> {
    logger.info("=== 性能监控功能演示 ===");

    const serviceName = "demo-service";

    // 初始化服务
    PerformanceMonitor.initializeService(serviceName);

    // 模拟一些操作
    const operations = [
      { name: "tool1", duration: 100, success: true },
      { name: "tool2", duration: 200, success: true },
      { name: "tool1", duration: 150, success: false },
      { name: "tool3", duration: 300, success: true },
      { name: "tool2", duration: 250, success: true },
    ];

    for (const op of operations) {
      const timerId = PerformanceMonitor.startTiming(
        serviceName,
        op.name,
        OperationType.TOOL_CALL
      );

      // 模拟操作延迟
      await new Promise((resolve) => setTimeout(resolve, 10));

      PerformanceMonitor.endTiming(timerId, op.success);

      if (op.success) {
        PerformanceMonitor.recordSuccess(serviceName, op.name, op.duration);
      } else {
        PerformanceMonitor.recordError(serviceName, op.name);
      }
    }

    // 获取性能指标
    const metrics = PerformanceMonitor.getMetrics(serviceName);
    if (metrics) {
      logger.info(`服务: ${metrics.serviceName}`);
      logger.info(`总操作数: ${metrics.totalOperations}`);
      logger.info(`成功操作: ${metrics.successfulOperations}`);
      logger.info(`失败操作: ${metrics.failedOperations}`);
      logger.info(`成功率: ${(metrics.successRate * 100).toFixed(1)}%`);
      logger.info(`错误率: ${(metrics.errorRate * 100).toFixed(1)}%`);
      logger.info(
        `平均工具调用延迟: ${metrics.averageToolCallLatency.toFixed(0)}ms`
      );
      logger.info(`运行时间: ${(metrics.uptime / 1000).toFixed(1)}s`);
    }

    // 生成性能报告
    const report = PerformanceMonitor.getPerformanceReport();
    logger.info("性能报告:");
    logger.info(`总服务数: ${report.summary.totalServices}`);
    logger.info(`总操作数: ${report.summary.totalOperations}`);
    logger.info(
      `平均成功率: ${(report.summary.averageSuccessRate * 100).toFixed(1)}%`
    );
    logger.info(
      `平均错误率: ${(report.summary.averageErrorRate * 100).toFixed(1)}%`
    );
  }

  /**
   * 演示健康检查功能
   */
  async demonstrateHealthChecking(): Promise<void> {
    logger.info("=== 健康检查功能演示 ===");

    // 配置健康检查
    HealthChecker.updateConfig({
      interval: 10000, // 10秒检查一次
      maxErrorRate: 0.1, // 10% 错误率阈值
      maxResponseTime: 1000, // 1秒响应时间阈值
      autoRecover: true,
    });

    // 添加一些测试服务配置
    const testConfigs: MCPServiceConfig[] = [
      {
        name: "test-stdio-service",
        type: "stdio",
        command: "echo",
        args: ["Hello MCP"],
      },
    ];

    for (const config of testConfigs) {
      this.serviceManager.addServiceConfig(config);
    }

    try {
      // 启动服务
      await this.serviceManager.startAllServices();

      // 检查所有服务的健康状态
      const healthStatuses = await HealthChecker.checkAllServices(
        this.serviceManager
      );

      logger.info("健康检查结果:");
      for (const [serviceName, status] of healthStatuses) {
        logger.info(`服务: ${serviceName}`);
        logger.info(`健康状态: ${status.healthy ? "健康" : "不健康"}`);
        logger.info(`连接稳定: ${status.connectionStable ? "是" : "否"}`);
        logger.info(`响应时间: ${status.responseTime.toFixed(0)}ms`);
        logger.info(`错误率: ${(status.errorRate * 100).toFixed(1)}%`);
        logger.info(`运行时间: ${(status.uptime / 1000).toFixed(1)}s`);
        if (status.issues.length > 0) {
          logger.info(`问题: ${status.issues.join(", ")}`);
        }
        logger.info("---");
      }

      // 生成健康报告
      const healthReport = HealthChecker.getHealthReport(healthStatuses);
      logger.info("健康报告:");
      logger.info(
        `整体健康: ${healthReport.overallHealth ? "健康" : "不健康"}`
      );
      logger.info(`总服务数: ${healthReport.totalServices}`);
      logger.info(`健康服务: ${healthReport.healthyServices}`);
      logger.info(`不健康服务: ${healthReport.unhealthyServices}`);
      logger.info(
        `平均响应时间: ${healthReport.summary.averageResponseTime.toFixed(0)}ms`
      );
      logger.info(
        `平均错误率: ${(healthReport.summary.averageErrorRate * 100).toFixed(1)}%`
      );
      logger.info(`总问题数: ${healthReport.summary.totalIssues}`);
    } catch (error) {
      logger.error("健康检查演示失败:", error);
    } finally {
      // 清理
      await this.serviceManager.stopAllServices();
    }
  }

  /**
   * 演示配置热重载功能
   */
  async demonstrateConfigWatching(): Promise<void> {
    logger.info("=== 配置热重载功能演示 ===");

    // 设置配置变更回调
    ConfigWatcher.onConfigChange(async (event) => {
      logger.info(`配置变更事件: ${event.type}`);
      if (event.serviceName) {
        logger.info(`服务: ${event.serviceName}`);
      }
      logger.info(`时间: ${event.timestamp.toISOString()}`);

      switch (event.type) {
        case ConfigChangeType.ADDED:
          logger.info(`新增服务配置: ${event.newConfig?.name}`);
          if (event.newConfig) {
            this.serviceManager.addServiceConfig(event.newConfig);
          }
          break;
        case ConfigChangeType.MODIFIED:
          logger.info(`修改服务配置: ${event.serviceName}`);
          if (event.newConfig) {
            this.serviceManager.updateServiceConfig(
              event.serviceName!,
              event.newConfig
            );
          }
          break;
        case ConfigChangeType.REMOVED:
          logger.info(`删除服务配置: ${event.serviceName}`);
          this.serviceManager.removeServiceConfig(event.serviceName!);
          break;
        case ConfigChangeType.RELOADED:
          logger.info(
            `配置文件重新加载，共 ${event.allConfigs?.length || 0} 个服务`
          );
          break;
      }
    });

    try {
      // 开始监听配置文件
      ConfigWatcher.startWatching(this.configPath);
      logger.info(`开始监听配置文件: ${this.configPath}`);

      // 获取当前配置
      const currentConfigs = ConfigWatcher.getCurrentConfigs();
      logger.info(`当前配置包含 ${currentConfigs.length} 个服务`);

      // 演示配置验证
      const testConfig = [
        {
          name: "valid-service",
          type: "stdio",
          command: "echo",
          args: ["test"],
        },
        {
          name: "invalid-service",
          // 缺少 type 字段
          command: "echo",
        } as MCPServiceConfig,
      ];

      const validation = ConfigWatcher.validateConfig(testConfig);
      logger.info("配置验证结果:");
      logger.info(`有效: ${validation.valid ? "是" : "否"}`);
      if (validation.errors.length > 0) {
        logger.info(`错误: ${validation.errors.join(", ")}`);
      }
      if (validation.warnings.length > 0) {
        logger.info(`警告: ${validation.warnings.join(", ")}`);
      }

      logger.info("配置监听已启动，可以手动修改配置文件来测试热重载功能");
      logger.info("按 Ctrl+C 退出演示");

      // 保持程序运行以监听配置变更
      await new Promise((resolve) => {
        process.on("SIGINT", () => {
          logger.info("收到退出信号，停止配置监听");
          resolve(void 0);
        });
      });
    } catch (error) {
      logger.error("配置监听演示失败:", error);
    } finally {
      ConfigWatcher.stopWatching();
    }
  }

  /**
   * 运行完整演示
   */
  async runFullDemo(): Promise<void> {
    logger.info("🚀 开始高级功能完整演示");

    try {
      await this.demonstrateErrorHandling();
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await this.demonstratePerformanceMonitoring();
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await this.demonstrateHealthChecking();
      await new Promise((resolve) => setTimeout(resolve, 1000));

      logger.info("✅ 高级功能演示完成");
      logger.info("要演示配置热重载功能，请运行: npm run demo:config-watch");
    } catch (error) {
      logger.error("演示过程中发生错误:", error);
    }
  }
}

// 如果直接运行此文件，执行演示
if (import.meta.url === `file://${process.argv[1]}`) {
  const demo = new AdvancedFeaturesDemo();

  const command = process.argv[2];
  switch (command) {
    case "error":
      demo.demonstrateErrorHandling();
      break;
    case "performance":
      demo.demonstratePerformanceMonitoring();
      break;
    case "health":
      demo.demonstrateHealthChecking();
      break;
    case "config":
      demo.demonstrateConfigWatching();
      break;
    default:
      demo.runFullDemo();
  }
}

export { AdvancedFeaturesDemo };
