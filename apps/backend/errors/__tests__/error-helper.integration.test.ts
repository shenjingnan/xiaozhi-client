import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { InternalMCPServiceConfig } from "@/lib/mcp";
import { MCPTransportType } from "@/lib/mcp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Logger } from "../../Logger.js";
import type { MCPError } from "../ErrorHelper.js";
import {
  ErrorCategory,
  categorizeError,
  clearErrorHistory,
  getErrorStatistics,
  shouldAlert,
} from "../ErrorHelper.js";

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
    const testConfigs: InternalMCPServiceConfig[] = [
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

  describe("Error Handling Integration", () => {
    it("should categorize errors correctly", () => {
      const serviceName = "test-service";

      // Simulate different types of errors
      const toolError = new Error("Tool call failed");
      const connectionError = new Error("Connection failed");
      const configError = new Error("Invalid configuration");

      const mcpToolError = categorizeError(toolError, serviceName);
      const mcpConnectionError = categorizeError(connectionError, serviceName);
      const mcpConfigError = categorizeError(configError, serviceName);

      // Verify error categorization
      expect(mcpToolError.category).toBe(ErrorCategory.TOOL_CALL);
      expect(mcpConnectionError.category).toBe(ErrorCategory.CONNECTION);
      expect(mcpConfigError.category).toBe(ErrorCategory.CONFIGURATION);
    });

    it("should trigger alerts for high error rates", () => {
      const serviceName = "test-service-2";

      // Generate multiple errors to trigger alert
      const errors: MCPError[] = [];
      for (let i = 0; i < 12; i++) {
        const error = new Error(`Error ${i}`);
        const mcpError = categorizeError(error, serviceName);
        errors.push(mcpError);

        if (i === 11) {
          // Last error should trigger alert
          expect(shouldAlert(mcpError)).toBe(true);
        }
      }

      // Verify error statistics
      const errorStats = getErrorStatistics(serviceName);
      expect(errorStats.totalErrors).toBe(12);
    });
  });
});
