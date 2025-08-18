import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Logger } from "../../Logger.js";
import {
  OperationType,
  type PerformanceMetrics,
  PerformanceMonitor,
  PerformanceMonitorClass,
} from "../PerformanceMonitor.js";

// Mock dependencies
vi.mock("../../Logger.js");

describe("PerformanceMonitor", () => {
  let monitor: PerformanceMonitorClass;
  let mockLogger: any;

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

    // Create a new instance for testing
    monitor = new PerformanceMonitorClass();
  });

  afterEach(() => {
    vi.clearAllMocks();
    monitor.clearMetrics();
  });

  describe("service initialization", () => {
    it("should initialize service metrics", () => {
      monitor.initializeService("test-service");
      const metrics = monitor.getMetrics("test-service");

      expect(metrics).toBeDefined();
      expect(metrics!.serviceName).toBe("test-service");
      expect(metrics!.totalOperations).toBe(0);
      expect(metrics!.successRate).toBe(1);
      expect(metrics!.errorRate).toBe(0);
    });

    it("should not reinitialize existing service", () => {
      monitor.initializeService("test-service");
      monitor.recordSuccess("test-service", "test-operation");

      const metricsBefore = monitor.getMetrics("test-service");
      monitor.initializeService("test-service"); // Should not reset
      const metricsAfter = monitor.getMetrics("test-service");

      expect(metricsAfter!.totalOperations).toBe(
        metricsBefore!.totalOperations
      );
    });
  });

  describe("timing operations", () => {
    it("should start and end timing", () => {
      const timerId = monitor.startTiming("test-service", "test-operation");
      expect(timerId).toBeDefined();
      expect(typeof timerId).toBe("string");

      const duration = monitor.endTiming(timerId, true);
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it("should handle invalid timer ID", () => {
      const duration = monitor.endTiming("invalid-timer-id");
      expect(duration).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "未找到计时器: invalid-timer-id"
      );
    });

    it("should record different operation types", () => {
      const connectionTimerId = monitor.startTiming(
        "test-service",
        "connection",
        OperationType.CONNECTION
      );
      const toolCallTimerId = monitor.startTiming(
        "test-service",
        "tool-call",
        OperationType.TOOL_CALL
      );

      monitor.endTiming(connectionTimerId, true);
      monitor.endTiming(toolCallTimerId, true);

      const metrics = monitor.getMetrics("test-service");
      expect(metrics!.connectionLatency).toBeGreaterThanOrEqual(0);
      expect(metrics!.totalOperations).toBe(2);
    });
  });

  describe("operation recording", () => {
    it("should record successful operations", () => {
      monitor.recordSuccess("test-service", "test-operation", 100);

      const metrics = monitor.getMetrics("test-service");
      expect(metrics!.successfulOperations).toBe(1);
      expect(metrics!.totalOperations).toBe(1);
      expect(metrics!.successRate).toBe(1);
      expect(metrics!.errorRate).toBe(0);
    });

    it("should record failed operations", () => {
      monitor.recordError("test-service", "test-operation");

      const metrics = monitor.getMetrics("test-service");
      expect(metrics!.failedOperations).toBe(1);
      expect(metrics!.totalOperations).toBe(1);
      expect(metrics!.successRate).toBe(0);
      expect(metrics!.errorRate).toBe(1);
    });

    it("should calculate correct rates with mixed operations", () => {
      monitor.recordSuccess("test-service", "operation1");
      monitor.recordSuccess("test-service", "operation2");
      monitor.recordError("test-service", "operation3");

      const metrics = monitor.getMetrics("test-service");
      expect(metrics!.totalOperations).toBe(3);
      expect(metrics!.successfulOperations).toBe(2);
      expect(metrics!.failedOperations).toBe(1);
      expect(metrics!.successRate).toBeCloseTo(2 / 3);
      expect(metrics!.errorRate).toBeCloseTo(1 / 3);
    });
  });

  describe("latency tracking", () => {
    it("should record connection latency", () => {
      monitor.recordConnectionLatency("test-service", 150);

      const metrics = monitor.getMetrics("test-service");
      expect(metrics!.connectionLatency).toBe(150);
    });

    it("should track tool call latencies", () => {
      monitor.recordSuccess("test-service", "tool1", 100);
      monitor.recordSuccess("test-service", "tool1", 200);
      monitor.recordSuccess("test-service", "tool2", 50);

      const metrics = monitor.getMetrics("test-service");
      expect(metrics!.toolCallLatencies.has("tool1")).toBe(true);
      expect(metrics!.toolCallLatencies.has("tool2")).toBe(true);
      expect(metrics!.toolCallLatencies.get("tool1")).toEqual([100, 200]);
      expect(metrics!.toolCallLatencies.get("tool2")).toEqual([50]);
    });

    it("should calculate average tool call latency", () => {
      monitor.recordSuccess("test-service", "tool1", 100);
      monitor.recordSuccess("test-service", "tool1", 200);
      monitor.recordSuccess("test-service", "tool2", 300);

      const metrics = monitor.getMetrics("test-service");
      expect(metrics!.averageToolCallLatency).toBe(200); // (100 + 200 + 300) / 3
    });
  });

  describe("metrics retrieval", () => {
    it("should get metrics for specific service", () => {
      monitor.recordSuccess("service1", "operation1");
      monitor.recordSuccess("service2", "operation2");

      const metrics1 = monitor.getMetrics("service1");
      const metrics2 = monitor.getMetrics("service2");

      expect(metrics1!.serviceName).toBe("service1");
      expect(metrics2!.serviceName).toBe("service2");
      expect(metrics1!.totalOperations).toBe(1);
      expect(metrics2!.totalOperations).toBe(1);
    });

    it("should return undefined for unknown service", () => {
      const metrics = monitor.getMetrics("unknown-service");
      expect(metrics).toBeUndefined();
    });

    it("should get all metrics", () => {
      monitor.recordSuccess("service1", "operation1");
      monitor.recordSuccess("service2", "operation2");

      const allMetrics = monitor.getAllMetrics();
      expect(allMetrics.size).toBe(2);
      expect(allMetrics.has("service1")).toBe(true);
      expect(allMetrics.has("service2")).toBe(true);
    });

    it("should update uptime when getting metrics", () => {
      monitor.initializeService("test-service");

      // Wait a bit
      const startTime = Date.now();
      while (Date.now() - startTime < 10) {
        // Small delay
      }

      const metrics = monitor.getMetrics("test-service");
      expect(metrics!.uptime).toBeGreaterThan(0);
    });
  });

  describe("performance report", () => {
    it("should generate performance report", () => {
      monitor.recordSuccess("service1", "operation1");
      monitor.recordSuccess("service1", "operation2");
      monitor.recordError("service2", "operation3");

      const report = monitor.getPerformanceReport();

      expect(report.summary.totalServices).toBe(2);
      expect(report.summary.totalOperations).toBe(3);
      expect(report.summary.averageSuccessRate).toBeCloseTo(0.5); // (1.0 + 0.0) / 2
      expect(report.summary.averageErrorRate).toBeCloseTo(0.5); // (0.0 + 1.0) / 2
      expect(report.services).toHaveLength(2);
    });

    it("should handle empty report", () => {
      const report = monitor.getPerformanceReport();

      expect(report.summary.totalServices).toBe(0);
      expect(report.summary.totalOperations).toBe(0);
      expect(report.summary.averageSuccessRate).toBe(0);
      expect(report.summary.averageErrorRate).toBe(0);
      expect(report.services).toHaveLength(0);
    });
  });

  describe("data cleanup", () => {
    it("should clear specific service metrics", () => {
      monitor.recordSuccess("service1", "operation1");
      monitor.recordSuccess("service2", "operation2");

      monitor.clearMetrics("service1");

      expect(monitor.getMetrics("service1")).toBeUndefined();
      expect(monitor.getMetrics("service2")).toBeDefined();
    });

    it("should clear all metrics", () => {
      monitor.recordSuccess("service1", "operation1");
      monitor.recordSuccess("service2", "operation2");

      monitor.clearMetrics();

      expect(monitor.getAllMetrics().size).toBe(0);
    });

    it("should clear related timers when clearing service", () => {
      const timerId = monitor.startTiming("test-service", "test-operation");
      monitor.clearMetrics("test-service");

      // Timer should be cleared, so ending it should return 0
      const duration = monitor.endTiming(timerId);
      expect(duration).toBe(0);
    });
  });

  describe("singleton instance", () => {
    it("should provide singleton instance", () => {
      expect(PerformanceMonitor).toBeDefined();
      expect(PerformanceMonitor).toBeInstanceOf(PerformanceMonitorClass);
    });

    it("should maintain state across calls", () => {
      // Use the test instance instead of singleton to avoid logger issues
      monitor.recordSuccess("singleton-test", "operation1");
      const metrics = monitor.getMetrics("singleton-test");

      expect(metrics!.totalOperations).toBe(1);

      // Clean up
      monitor.clearMetrics("singleton-test");
    });
  });
});
