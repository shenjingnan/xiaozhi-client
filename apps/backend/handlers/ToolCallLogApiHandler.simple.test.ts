/**
 * 工具调用日志 API 处理器简化测试
 * 专注于基本功能验证
 */

import { PAGINATION_CONSTANTS } from "@constants/ApiConstants.js";
import { describe, expect, it } from "vitest";
import { ToolCallLogApiHandler } from "./ToolCallLogApiHandler.js";

describe("ToolCallLogApiHandler - 基本功能测试", () => {
  it("应该能够创建处理器实例", () => {
    const handler = new ToolCallLogApiHandler();
    expect(handler).toBeDefined();
    expect(handler).toBeInstanceOf(ToolCallLogApiHandler);
  });

  it("应该能够创建成功响应", () => {
    const handler = new ToolCallLogApiHandler();
    const createSuccessResponse = (handler as any).createSuccessResponse.bind(
      handler
    );
    const testData = { message: "test data" };

    const response = createSuccessResponse(testData);
    expect(response).toBeInstanceOf(Response);
    expect(response).toBeDefined();
  });

  it("应该能够创建错误响应", () => {
    const handler = new ToolCallLogApiHandler();
    const createErrorResponse = (handler as any).createErrorResponse.bind(
      handler
    );

    const response = createErrorResponse("TEST_ERROR", "Test message");
    expect(response).toBeInstanceOf(Response);
    expect(response).toBeDefined();
  });

  it("应该正确映射 HTTP 状态码", () => {
    const handler = new ToolCallLogApiHandler();
    const getHttpStatusCode = (handler as any).getHttpStatusCode.bind(handler);

    expect(getHttpStatusCode("INVALID_QUERY_PARAMETERS")).toBe(400);
    expect(getHttpStatusCode("LOG_FILE_NOT_FOUND")).toBe(404);
    expect(getHttpStatusCode("INTERNAL_ERROR")).toBe(500);
  });

  it("应该能够解析和验证查询参数", () => {
    const handler = new ToolCallLogApiHandler();
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
