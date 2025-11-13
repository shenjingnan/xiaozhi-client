import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Logger } from "../../Logger";
import { ConfigWatcherClass } from "../ConfigWatcher.js";
import {
  ErrorCategory,
  categorizeError,
  clearErrorHistory,
  getErrorStatistics,
  shouldAlert,
} from "../ErrorHandler.js";
import type { MCPServiceConfig } from "../MCPService.js";
import { MCPTransportType } from "../MCPService.js";
import {
  OperationType,
  PerformanceMonitorClass,
} from "../PerformanceMonitor.js";

// Mock dependencies
vi.mock("../../Logger.js");

describe("Advanced Features Integration", () => {
  let mockLogger: any;
  let testConfigPath: string;

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

    // Create test configuration
    const testConfigs: MCPServiceConfig[] = [
      {
        name: "test-service",
        type: MCPTransportType.STDIO,
        command: "test-command",
        args: ["--test"],
      },
    ];

    testConfigPath = join(
      tmpdir(),
      `integration-test-config-${Date.now()}.json`
    );
    writeFileSync(
      testConfigPath,
      JSON.stringify({ mcpServices: testConfigs }, null, 2)
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    clearErrorHistory();

    // Clean up test file
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
  });

  describe("Error Handling + Performance Monitoring Integration", () => {
    it("should track performance metrics for error scenarios", () => {
      const serviceName = "test-service";
      const performanceMonitor = new PerformanceMonitorClass();

      // Start timing an operation
      const timerId = performanceMonitor.startTiming(
        serviceName,
        "test-operation",
        OperationType.TOOL_CALL
      );

      // Simulate an error
      const error = new Error("Tool call failed");
      const mcpError = categorizeError(error, serviceName);

      // End timing with failure
      performanceMonitor.endTiming(timerId, false);

      // Record the error
      performanceMonitor.recordError(serviceName, "test-operation");

      // Check that both systems recorded the failure
      const errorStats = getErrorStatistics(serviceName);
      const perfMetrics = performanceMonitor.getMetrics(serviceName);

      expect(errorStats.totalErrors).toBe(1);
      expect(errorStats.errorsByCategory.get(ErrorCategory.TOOL_CALL)).toBe(1);
      expect(perfMetrics!.failedOperations).toBe(2); // endTiming + recordError both increment
      expect(perfMetrics!.totalOperations).toBe(2);
      expect(perfMetrics!.errorRate).toBe(1);
      expect(mcpError.category).toBe(ErrorCategory.TOOL_CALL);
    });

    it("should correlate error alerts with performance degradation", () => {
      const serviceName = "test-service-2";
      const performanceMonitor = new PerformanceMonitorClass();

      // Generate multiple errors to trigger alert
      for (let i = 0; i < 12; i++) {
        const error = new Error(`Error ${i}`);
        const mcpError = categorizeError(error, serviceName);
        performanceMonitor.recordError(serviceName, `operation-${i}`);

        if (i === 11) {
          // Last error should trigger alert
          expect(shouldAlert(mcpError)).toBe(true);
        }
      }

      const perfMetrics = performanceMonitor.getMetrics(serviceName);
      expect(perfMetrics!.errorRate).toBe(1); // 100% error rate
      expect(perfMetrics!.failedOperations).toBe(12);
    });
  });

  describe("Configuration Validation Integration", () => {
    it("should handle configuration validation errors gracefully", () => {
      const configWatcher = new ConfigWatcherClass();
      const invalidConfig = [
        {
          name: "invalid-service",
          // Missing type field
          command: "test-command",
        } as MCPServiceConfig,
      ];

      const validation = configWatcher.validateConfig(invalidConfig);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        "服务 invalid-service 缺少 type 字段"
      );
    });
  });
});
