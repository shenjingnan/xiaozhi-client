import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { InternalMCPServiceConfig } from "@/lib/mcp/index.js";
import { MCPTransportType } from "@/lib/mcp/index.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Logger } from "../../Logger.js";
import type { MCPError } from "../error-helper.js";
import {
  ErrorCategory,
  categorizeError,
  clearErrorHistory,
  getErrorStatistics,
  shouldAlert,
} from "../error-helper.js";

// 模拟依赖
vi.mock("../../Logger.js");

describe("高级功能集成测试", () => {
  let mockLogger: any;
  let testConfigPath: string;

  beforeEach(() => {
    vi.clearAllMocks();

    // 模拟 Logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      withTag: vi.fn().mockReturnThis(),
    };
    vi.mocked(Logger).mockImplementation(() => mockLogger);

    // 创建测试配置
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

    // 清理测试文件
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
  });

  describe("错误处理集成", () => {
    it("应该正确分类错误", () => {
      const serviceName = "test-service";

      // 模拟不同类型的错误
      const toolError = new Error("Tool call failed");
      const connectionError = new Error("Connection failed");
      const configError = new Error("Invalid configuration");

      const mcpToolError = categorizeError(toolError, serviceName);
      const mcpConnectionError = categorizeError(connectionError, serviceName);
      const mcpConfigError = categorizeError(configError, serviceName);

      // 验证错误分类
      expect(mcpToolError.category).toBe(ErrorCategory.TOOL_CALL);
      expect(mcpConnectionError.category).toBe(ErrorCategory.CONNECTION);
      expect(mcpConfigError.category).toBe(ErrorCategory.CONFIGURATION);
    });

    it("应该为高错误率触发警报", () => {
      const serviceName = "test-service-2";

      // 生成多个错误以触发警报
      const errors: MCPError[] = [];
      for (let i = 0; i < 12; i++) {
        const error = new Error(`Error ${i}`);
        const mcpError = categorizeError(error, serviceName);
        errors.push(mcpError);

        if (i === 11) {
          // 最后一个错误应该触发警报
          expect(shouldAlert(mcpError)).toBe(true);
        }
      }

      // 验证错误统计
      const errorStats = getErrorStatistics(serviceName);
      expect(errorStats.totalErrors).toBe(12);
    });
  });
});
