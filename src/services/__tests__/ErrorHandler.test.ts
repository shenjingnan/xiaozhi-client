import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Logger } from "../../Logger";
import type { MCPError } from "../ErrorHandler.js";
import {
  ErrorCategory,
  RecoveryStrategy,
  categorizeError,
  clearErrorHistory,
  formatUserFriendlyMessage,
  getAllErrorStatistics,
  getErrorStatistics,
  shouldAlert,
} from "../ErrorHandler.js";

// Mock dependencies
vi.mock("../../Logger.js");

describe("ErrorHandler", () => {
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

    // Clear error history
    clearErrorHistory();
  });

  afterEach(() => {
    vi.clearAllMocks();
    clearErrorHistory();
  });

  describe("categorizeError", () => {
    it("should categorize connection errors", () => {
      const error = new Error("Connection refused");
      const mcpError = categorizeError(error, "test-service");

      expect(mcpError.category).toBe(ErrorCategory.CONNECTION);
      expect(mcpError.code).toBe("CONNECTION_FAILED");
      expect(mcpError.recoverable).toBe(true);
      expect(mcpError.recoveryStrategy).toBe(RecoveryStrategy.RECONNECT);
      expect(mcpError.serviceName).toBe("test-service");
    });

    it("should categorize transport errors", () => {
      const error = new Error("Transport initialization failed");
      const mcpError = categorizeError(error, "test-service");

      expect(mcpError.category).toBe(ErrorCategory.TRANSPORT);
      expect(mcpError.code).toBe("TRANSPORT_ERROR");
      expect(mcpError.recoverable).toBe(true);
      expect(mcpError.recoveryStrategy).toBe(RecoveryStrategy.RESTART_SERVICE);
    });

    it("should categorize tool call errors", () => {
      const error = new Error("Tool method not found");
      const mcpError = categorizeError(error, "test-service");

      expect(mcpError.category).toBe(ErrorCategory.TOOL_CALL);
      expect(mcpError.code).toBe("TOOL_CALL_ERROR");
      expect(mcpError.recoverable).toBe(true);
      expect(mcpError.recoveryStrategy).toBe(RecoveryStrategy.RETRY);
    });

    it("should categorize configuration errors", () => {
      const error = new Error("Invalid config provided");
      const mcpError = categorizeError(error, "test-service");

      expect(mcpError.category).toBe(ErrorCategory.CONFIGURATION);
      expect(mcpError.code).toBe("CONFIG_ERROR");
      expect(mcpError.recoverable).toBe(false);
      expect(mcpError.recoveryStrategy).toBe(
        RecoveryStrategy.MANUAL_INTERVENTION
      );
    });

    it("should categorize timeout errors", () => {
      const error = new Error("Request timed out");
      const mcpError = categorizeError(error, "test-service");

      expect(mcpError.category).toBe(ErrorCategory.TIMEOUT);
      expect(mcpError.code).toBe("TIMEOUT_ERROR");
      expect(mcpError.recoverable).toBe(true);
      expect(mcpError.recoveryStrategy).toBe(RecoveryStrategy.RETRY);
    });

    it("should categorize authentication errors", () => {
      const error = new Error("Unauthorized access");
      const mcpError = categorizeError(error, "test-service");

      expect(mcpError.category).toBe(ErrorCategory.AUTHENTICATION);
      expect(mcpError.code).toBe("AUTH_ERROR");
      expect(mcpError.recoverable).toBe(false);
      expect(mcpError.recoveryStrategy).toBe(
        RecoveryStrategy.MANUAL_INTERVENTION
      );
    });

    it("should categorize network errors", () => {
      const error = new Error("Network request failed");
      const mcpError = categorizeError(error, "test-service");

      expect(mcpError.category).toBe(ErrorCategory.NETWORK);
      expect(mcpError.code).toBe("NETWORK_ERROR");
      expect(mcpError.recoverable).toBe(true);
      expect(mcpError.recoveryStrategy).toBe(RecoveryStrategy.RETRY);
    });

    it("should handle unknown errors", () => {
      const error = new Error("Some unknown error");
      const mcpError = categorizeError(error, "test-service");

      expect(mcpError.category).toBe(ErrorCategory.UNKNOWN);
      expect(mcpError.code).toBe("UNKNOWN_ERROR");
      expect(mcpError.recoverable).toBe(false);
      expect(mcpError.recoveryStrategy).toBe(
        RecoveryStrategy.MANUAL_INTERVENTION
      );
    });

    it("should include context information", () => {
      const error = new Error("Test error");
      const context = { operation: "tool_call", toolName: "test_tool" };
      const mcpError = categorizeError(error, "test-service", context);

      expect(mcpError.context).toEqual(context);
      expect(mcpError.originalError).toBe(error);
    });
  });

  describe("formatUserFriendlyMessage", () => {
    it("should format connection error messages", () => {
      const error: MCPError = {
        category: ErrorCategory.CONNECTION,
        code: "CONNECTION_FAILED",
        message: "Connection refused",
        serviceName: "test-service",
        timestamp: new Date(),
        recoverable: true,
        recoveryStrategy: RecoveryStrategy.RECONNECT,
      };

      const message = formatUserFriendlyMessage(error);
      expect(message).toBe(
        "服务 test-service 发生错误：连接失败，正在尝试重新连接..."
      );
    });

    it("should format tool call error messages", () => {
      const error: MCPError = {
        category: ErrorCategory.TOOL_CALL,
        code: "TOOL_CALL_ERROR",
        message: "Invalid params",
        serviceName: "test-service",
        timestamp: new Date(),
        recoverable: true,
        recoveryStrategy: RecoveryStrategy.RETRY,
      };

      const message = formatUserFriendlyMessage(error);
      expect(message).toBe(
        "服务 test-service 发生错误：工具调用失败，请检查参数后重试"
      );
    });

    it("should format configuration error messages", () => {
      const error: MCPError = {
        category: ErrorCategory.CONFIGURATION,
        code: "CONFIG_ERROR",
        message: "Invalid config",
        serviceName: "test-service",
        timestamp: new Date(),
        recoverable: false,
        recoveryStrategy: RecoveryStrategy.MANUAL_INTERVENTION,
      };

      const message = formatUserFriendlyMessage(error);
      expect(message).toBe(
        "服务 test-service 发生错误：配置错误，请检查服务配置"
      );
    });
  });

  describe("error statistics", () => {
    it("should track error statistics", () => {
      const error1 = new Error("Connection failed");
      const error2 = new Error("Tool call failed");
      const error3 = new Error("Connection failed");

      categorizeError(error1, "test-service");
      categorizeError(error2, "test-service");
      categorizeError(error3, "test-service");

      const stats = getErrorStatistics("test-service");

      expect(stats.totalErrors).toBe(3);
      expect(stats.errorsByCategory.get(ErrorCategory.CONNECTION)).toBe(2);
      expect(stats.errorsByCategory.get(ErrorCategory.TOOL_CALL)).toBe(1);
    });

    it("should calculate error rate", () => {
      const error = new Error("Test error");
      categorizeError(error, "test-service");

      const stats = getErrorStatistics("test-service");
      expect(stats.errorRate).toBe(1); // 1 error in the past hour
    });

    it("should return empty statistics for unknown service", () => {
      const stats = getErrorStatistics("unknown-service");

      expect(stats.totalErrors).toBe(0);
      expect(stats.errorsByCategory.size).toBe(0);
      expect(stats.errorsByCode.size).toBe(0);
      expect(stats.lastError).toBeUndefined();
      expect(stats.errorRate).toBe(0);
    });
  });

  describe("shouldAlert", () => {
    it("should alert for high error rate", () => {
      // Generate 11 errors to exceed threshold
      for (let i = 0; i < 11; i++) {
        const error = new Error(`Error ${i}`);
        categorizeError(error, "test-service");
      }

      const lastError = getErrorStatistics("test-service").lastError!;
      expect(shouldAlert(lastError)).toBe(true);
    });

    it("should alert for non-recoverable errors", () => {
      const error = new Error("Invalid config");
      const mcpError = categorizeError(error, "test-service");

      expect(shouldAlert(mcpError)).toBe(true);
    });

    it("should alert for authentication errors", () => {
      const error = new Error("Unauthorized");
      const mcpError = categorizeError(error, "test-service");

      expect(shouldAlert(mcpError)).toBe(true);
    });

    it("should not alert for recoverable errors with low rate", () => {
      const error = new Error("Connection failed");
      const mcpError = categorizeError(error, "test-service");

      expect(shouldAlert(mcpError)).toBe(false);
    });
  });

  describe("clearErrorHistory", () => {
    it("should clear specific service error history", () => {
      const error = new Error("Test error");
      categorizeError(error, "test-service");

      let stats = getErrorStatistics("test-service");
      expect(stats.totalErrors).toBe(1);

      clearErrorHistory("test-service");

      stats = getErrorStatistics("test-service");
      expect(stats.totalErrors).toBe(0);
    });

    it("should clear all error history", () => {
      const error1 = new Error("Test error 1");
      const error2 = new Error("Test error 2");
      categorizeError(error1, "service1");
      categorizeError(error2, "service2");

      clearErrorHistory();

      const stats1 = getErrorStatistics("service1");
      const stats2 = getErrorStatistics("service2");
      expect(stats1.totalErrors).toBe(0);
      expect(stats2.totalErrors).toBe(0);
    });
  });
});
