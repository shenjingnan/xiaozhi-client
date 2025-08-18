import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Logger } from "../../Logger.js";
import {
  type HealthCheckConfig,
  HealthChecker,
  HealthCheckerClass,
  type HealthStatus,
} from "../HealthChecker.js";
import type { MCPService } from "../MCPService.js";
import type { MCPServiceManager } from "../MCPServiceManager.js";
import { PerformanceMonitor } from "../PerformanceMonitor.js";

// Mock dependencies
vi.mock("../../Logger.js");
vi.mock("../PerformanceMonitor.js");

describe("HealthChecker", () => {
  let healthChecker: HealthCheckerClass;
  let mockLogger: any;
  let mockService: MCPService;
  let mockManager: MCPServiceManager;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      withTag: vi.fn().mockReturnThis(),
    };
    vi.mocked(Logger).mockImplementation(() => mockLogger);

    // Mock PerformanceMonitor
    vi.mocked(PerformanceMonitor.getMetrics).mockReturnValue({
      serviceName: "test-service",
      connectionLatency: 100,
      averageToolCallLatency: 200,
      toolCallLatencies: new Map(),
      successRate: 0.95,
      errorRate: 0.05,
      totalOperations: 100,
      successfulOperations: 95,
      failedOperations: 5,
      lastUpdated: new Date(),
      uptime: 60000,
      startTime: new Date(Date.now() - 60000),
    });

    // Mock MCPService
    mockService = {
      getConfig: vi.fn().mockReturnValue({ name: "test-service" }),
      isConnected: vi.fn().mockReturnValue(true),
      getTools: vi.fn().mockReturnValue([
        { name: "tool1", description: "Test tool 1" },
        { name: "tool2", description: "Test tool 2" },
      ]),
      reconnect: vi.fn().mockResolvedValue(undefined),
    } as any;

    // Mock MCPServiceManager
    mockManager = {
      getAllServices: vi
        .fn()
        .mockReturnValue(new Map([["test-service", mockService]])),
    } as any;

    // Create a new instance for testing
    healthChecker = new HealthCheckerClass();
  });

  afterEach(() => {
    vi.clearAllMocks();
    healthChecker.stopPeriodicCheck();
    healthChecker.clearHealthHistory();
  });

  describe("service health check", () => {
    it("should check healthy service", async () => {
      const status = await healthChecker.checkService(mockService);

      expect(status.serviceName).toBe("test-service");
      expect(status.healthy).toBe(true);
      expect(status.connectionStable).toBe(true);
      expect(status.issues).toHaveLength(0);
      expect(status.uptime).toBe(60000);
      expect(status.errorRate).toBe(0.05);
    });

    it("should detect disconnected service", async () => {
      vi.mocked(mockService.isConnected).mockReturnValue(false);

      const status = await healthChecker.checkService(mockService);

      expect(status.healthy).toBe(false);
      expect(status.connectionStable).toBe(false);
      expect(status.issues).toContain("服务未连接");
    });

    it("should detect high error rate", async () => {
      vi.mocked(PerformanceMonitor.getMetrics).mockReturnValue({
        serviceName: "test-service",
        connectionLatency: 100,
        averageToolCallLatency: 200,
        toolCallLatencies: new Map(),
        successRate: 0.8,
        errorRate: 0.2, // High error rate
        totalOperations: 100,
        successfulOperations: 80,
        failedOperations: 20,
        lastUpdated: new Date(),
        uptime: 60000,
        startTime: new Date(Date.now() - 60000),
      });

      const status = await healthChecker.checkService(mockService);

      expect(status.healthy).toBe(false);
      expect(status.issues).toContain("错误率过高: 20.0%");
    });

    it("should detect slow response time", async () => {
      vi.mocked(PerformanceMonitor.getMetrics).mockReturnValue({
        serviceName: "test-service",
        connectionLatency: 100,
        averageToolCallLatency: 3000, // Slow response
        toolCallLatencies: new Map(),
        successRate: 0.95,
        errorRate: 0.05,
        totalOperations: 100,
        successfulOperations: 95,
        failedOperations: 5,
        lastUpdated: new Date(),
        uptime: 60000,
        startTime: new Date(Date.now() - 60000),
      });

      const status = await healthChecker.checkService(mockService);

      expect(status.healthy).toBe(false);
      expect(status.issues).toContain("响应时间过长: 3000ms");
    });

    it("should detect service with no tools", async () => {
      vi.mocked(mockService.getTools).mockReturnValue([]);

      const status = await healthChecker.checkService(mockService);

      expect(status.healthy).toBe(false);
      expect(status.issues).toContain("未发现可用工具");
    });

    it("should handle tool check errors", async () => {
      vi.mocked(mockService.getTools).mockImplementation(() => {
        throw new Error("Tool check failed");
      });

      const status = await healthChecker.checkService(mockService);

      expect(status.healthy).toBe(false);
      expect(status.issues).toContain("工具检查失败: Tool check failed");
      expect(status.lastError).toBe("Tool check failed");
    });

    it("should handle check exceptions", async () => {
      vi.mocked(mockService.isConnected).mockImplementation(() => {
        throw new Error("Connection check failed");
      });

      const status = await healthChecker.checkService(mockService);

      expect(status.healthy).toBe(false);
      expect(status.issues).toContain("健康检查异常: Connection check failed");
      expect(status.lastError).toBe("Connection check failed");
    });
  });

  describe("all services health check", () => {
    it("should check all services", async () => {
      const results = await healthChecker.checkAllServices(mockManager);

      expect(results.size).toBe(1);
      expect(results.has("test-service")).toBe(true);
      expect(results.get("test-service")!.healthy).toBe(true);
    });

    it("should handle service check errors", async () => {
      vi.mocked(mockService.isConnected).mockImplementation(() => {
        throw new Error("Service error");
      });

      const results = await healthChecker.checkAllServices(mockManager);

      expect(results.size).toBe(1);
      const status = results.get("test-service")!;
      expect(status.healthy).toBe(false);
      expect(status.issues).toContain("健康检查异常: Service error");
    });

    it("should attempt recovery for unhealthy services", async () => {
      vi.mocked(mockService.isConnected).mockReturnValue(false);

      await healthChecker.checkAllServices(mockManager);

      expect(mockService.reconnect).toHaveBeenCalled();
    });
  });

  describe("periodic health check", () => {
    it("should start and stop periodic check", () => {
      expect(healthChecker.getConfig().interval).toBeDefined();

      healthChecker.startPeriodicCheck(mockManager);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("开始定期健康检查")
      );

      healthChecker.stopPeriodicCheck();
      expect(mockLogger.info).toHaveBeenCalledWith("已停止定期健康检查");
    });

    it("should not start multiple periodic checks", () => {
      healthChecker.startPeriodicCheck(mockManager);
      healthChecker.startPeriodicCheck(mockManager);

      expect(mockLogger.warn).toHaveBeenCalledWith("定期健康检查已在运行");
    });
  });

  describe("health report", () => {
    it("should generate health report", () => {
      const healthStatuses = new Map<string, HealthStatus>([
        [
          "service1",
          {
            serviceName: "service1",
            healthy: true,
            lastCheck: new Date(),
            issues: [],
            uptime: 60000,
            responseTime: 100,
            connectionStable: true,
            errorRate: 0.05,
          },
        ],
        [
          "service2",
          {
            serviceName: "service2",
            healthy: false,
            lastCheck: new Date(),
            issues: ["Connection failed"],
            uptime: 30000,
            responseTime: 200,
            connectionStable: false,
            errorRate: 0.2,
          },
        ],
      ]);

      const report = healthChecker.getHealthReport(healthStatuses);

      expect(report.overallHealth).toBe(false);
      expect(report.totalServices).toBe(2);
      expect(report.healthyServices).toBe(1);
      expect(report.unhealthyServices).toBe(1);
      expect(report.services).toHaveLength(2);
      expect(report.summary.averageResponseTime).toBe(150);
      expect(report.summary.averageErrorRate).toBe(0.125);
      expect(report.summary.totalIssues).toBe(1);
    });

    it("should handle empty health report", () => {
      const healthStatuses = new Map<string, HealthStatus>();
      const report = healthChecker.getHealthReport(healthStatuses);

      expect(report.overallHealth).toBe(true);
      expect(report.totalServices).toBe(0);
      expect(report.healthyServices).toBe(0);
      expect(report.unhealthyServices).toBe(0);
      expect(report.services).toHaveLength(0);
      expect(report.summary.averageResponseTime).toBe(0);
      expect(report.summary.averageErrorRate).toBe(0);
      expect(report.summary.totalIssues).toBe(0);
    });
  });

  describe("health history", () => {
    it("should record and retrieve health history", async () => {
      await healthChecker.checkService(mockService);
      await healthChecker.checkService(mockService);

      const history = healthChecker.getHealthHistory("test-service");
      expect(history).toHaveLength(2);
      expect(history[0].serviceName).toBe("test-service");
    });

    it("should clear specific service history", async () => {
      await healthChecker.checkService(mockService);

      healthChecker.clearHealthHistory("test-service");
      const history = healthChecker.getHealthHistory("test-service");
      expect(history).toHaveLength(0);
    });

    it("should clear all history", async () => {
      await healthChecker.checkService(mockService);

      healthChecker.clearHealthHistory();
      const history = healthChecker.getHealthHistory("test-service");
      expect(history).toHaveLength(0);
    });
  });

  describe("configuration", () => {
    it("should update configuration", () => {
      const newConfig: Partial<HealthCheckConfig> = {
        interval: 60000,
        maxErrorRate: 0.2,
      };

      healthChecker.updateConfig(newConfig);
      const config = healthChecker.getConfig();

      expect(config.interval).toBe(60000);
      expect(config.maxErrorRate).toBe(0.2);
    });

    it("should get current configuration", () => {
      const config = healthChecker.getConfig();

      expect(config.interval).toBeDefined();
      expect(config.timeout).toBeDefined();
      expect(config.maxErrorRate).toBeDefined();
      expect(config.maxResponseTime).toBeDefined();
      expect(config.retryAttempts).toBeDefined();
      expect(config.autoRecover).toBeDefined();
    });
  });

  describe("singleton instance", () => {
    it("should provide singleton instance", () => {
      expect(HealthChecker).toBeDefined();
      expect(HealthChecker).toBeInstanceOf(HealthCheckerClass);
    });
  });
});
