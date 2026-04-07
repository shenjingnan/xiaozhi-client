/**
 * 工具调用日志 API 处理器简化测试
 * 专注于基本功能验证
 */

import { describe, expect, it } from "vitest";
import { PAGINATION_CONSTANTS } from "@/constants/api.constants.js";
import { MCPToolLogHandler } from "../mcp-tool-log.handler.js";

describe("MCPToolLogHandler - 基本功能测试", () => {
  it("应该能够创建处理器实例", () => {
    const handler = new MCPToolLogHandler();
    expect(handler).toBeDefined();
    expect(handler).toBeInstanceOf(MCPToolLogHandler);
  });

  it("应该能够解析和验证查询参数", () => {
    const handler = new MCPToolLogHandler();
    const parseAndValidateQueryParams = (
      handler as any
    ).parseAndValidateQueryParams.bind(handler);

    const mockContext = {
      req: {
        query: () => ({
          limit: "10",
          toolName: "test_tool",
          success: "true",
        }),
      },
      get: vi.fn((key: string) => {
        if (key === "logger") {
          return {
            debug: vi.fn(),
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
          };
        }
        return undefined;
      }),
    };

    // 测试有效参数
    const validResult = parseAndValidateQueryParams(mockContext);
    expect(validResult.success).toBe(true);
    expect(validResult.data).toEqual({
      limit: 10,
      toolName: "test_tool",
      success: true,
    });

    // 测试无效参数
    const invalidContext = {
      req: {
        query: () => ({
          limit: "300", // 超出范围
        }),
      },
      get: vi.fn((key: string) => {
        if (key === "logger") {
          return {
            debug: vi.fn(),
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
          };
        }
        return undefined;
      }),
    };

    const invalidResult = parseAndValidateQueryParams(invalidContext);
    expect(invalidResult.success).toBe(false);
    expect(invalidResult.error).toBeDefined();
    expect(Array.isArray(invalidResult.error)).toBe(true);
    expect(invalidResult.error[0].message).toContain(
      `limit 参数必须是 1-${PAGINATION_CONSTANTS.MAX_LIMIT} 之间的数字`
    );
  });
});
