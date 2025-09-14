/**
 * CustomMCPHandler 基础功能回归测试
 * 确保重构后的 CustomMCPHandler 仍然保持原有功能的向后兼容性
 */

import type {
  CustomMCPTool,
  FunctionHandlerConfig,
  HttpHandlerConfig,
  ProxyHandlerConfig,
} from "@/configManager.js";
import { CustomMCPHandler } from "@/services/CustomMCPHandler.js";
import { MCPCacheManager } from "@/services/MCPCacheManager.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Logger
const mockLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock MCPCacheManager
const mockCacheManager = {
  loadExistingCache: vi.fn(),
  saveCache: vi.fn(),
  cleanup: vi.fn(),
  getCustomMCPStatistics: vi.fn(),
  cleanupCustomMCPResults: vi.fn(),
  writeCustomMCPResult: vi.fn(),
  readCustomMCPResult: vi.fn(),
  updateCustomMCPStatus: vi.fn(),
  markCustomMCPAsConsumed: vi.fn(),
  deleteCustomMCPResult: vi.fn(),
  loadExtendedCache: vi.fn(),
  saveExtendedCache: vi.fn(),
};

describe("CustomMCPHandler 基础功能回归测试", () => {
  let customMCPHandler: CustomMCPHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    customMCPHandler = new CustomMCPHandler(mockCacheManager as any);
    (customMCPHandler as any).logger = mockLogger;
  });

  afterEach(() => {
    customMCPHandler.cleanup();
  });

  describe("工具管理功能测试", () => {
    it("应该正确初始化和加载工具", () => {
      const testTools: CustomMCPTool[] = [
        {
          name: "test_tool_1",
          description: "测试工具1",
          inputSchema: { type: "object", properties: {} },
          handler: { type: "function", module: "test.js", function: "test1" },
        },
        {
          name: "test_tool_2",
          description: "测试工具2",
          inputSchema: { type: "object", properties: {} },
          handler: {
            type: "proxy",
            platform: "coze",
            config: { workflow_id: "test" },
          },
        },
      ];

      customMCPHandler.initialize(testTools);

      expect(customMCPHandler.getToolCount()).toBe(2);
      expect(customMCPHandler.hasTool("test_tool_1")).toBe(true);
      expect(customMCPHandler.hasTool("test_tool_2")).toBe(true);
      expect(customMCPHandler.hasTool("nonexistent_tool")).toBe(false);
    });

    it("应该正确获取所有工具名称", () => {
      const testTools: CustomMCPTool[] = [
        {
          name: "tool_a",
          description: "工具A",
          inputSchema: {},
          handler: { type: "function", module: "a.js", function: "a" },
        },
        {
          name: "tool_b",
          description: "工具B",
          inputSchema: {},
          handler: { type: "function", module: "b.js", function: "b" },
        },
      ];

      customMCPHandler.initialize(testTools);

      const toolNames = customMCPHandler.getToolNames();
      expect(toolNames).toContain("tool_a");
      expect(toolNames).toContain("tool_b");
      expect(toolNames).toHaveLength(2);
    });

    it("应该返回正确的工具列表（MCP格式）", () => {
      const testTools: CustomMCPTool[] = [
        {
          name: "test_tool",
          description: "测试工具",
          inputSchema: {
            type: "object",
            properties: { param: { type: "string" } },
          },
          handler: { type: "function", module: "test.js", function: "test" },
        },
      ];

      customMCPHandler.initialize(testTools);
      const tools = customMCPHandler.getTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe("test_tool");
      expect(tools[0].description).toBe("测试工具");
      expect(tools[0].inputSchema).toEqual({
        type: "object",
        properties: { param: { type: "string" } },
      });
    });

    it("应该能够获取工具详细信息", () => {
      const testTool: CustomMCPTool = {
        name: "detailed_tool",
        description: "详细工具",
        inputSchema: { type: "object" },
        handler: {
          type: "function",
          module: "detailed.js",
          function: "detailed",
        },
        stats: { usageCount: 10, lastUsedTime: "2025-01-01T00:00:00Z" },
      };

      customMCPHandler.initialize([testTool]);

      const toolInfo = customMCPHandler.getToolInfo("detailed_tool");
      expect(toolInfo).toBeDefined();
      expect(toolInfo?.name).toBe("detailed_tool");
      expect(toolInfo?.stats?.usageCount).toBe(10);
    });

    it("应该清空现有工具并重新加载", () => {
      // 第一次初始化
      customMCPHandler.initialize([
        {
          name: "tool1",
          description: "工具1",
          inputSchema: {},
          handler: { type: "function", module: "1.js", function: "f1" },
        },
      ]);
      expect(customMCPHandler.getToolCount()).toBe(1);

      // 第二次初始化（应该清空现有工具）
      customMCPHandler.initialize([
        {
          name: "tool2",
          description: "工具2",
          inputSchema: {},
          handler: { type: "function", module: "2.js", function: "f2" },
        },
      ]);
      expect(customMCPHandler.getToolCount()).toBe(1);
      expect(customMCPHandler.hasTool("tool1")).toBe(false);
      expect(customMCPHandler.hasTool("tool2")).toBe(true);
    });
  });

  describe("函数工具调用测试", () => {
    it("应该正确调用函数工具", async () => {
      const functionTool: CustomMCPTool = {
        name: "function_tool",
        description: "函数工具",
        inputSchema: {
          type: "object",
          properties: { message: { type: "string" } },
        },
        handler: {
          type: "function",
          module: "./test-module.js",
          function: "testFunction",
        } as FunctionHandlerConfig,
      };

      customMCPHandler.initialize([functionTool]);

      // Mock callToolByType 方法
      vi.spyOn(customMCPHandler as any, "callToolByType").mockResolvedValue({
        content: [{ type: "text", text: "处理结果: 测试" }],
        isError: false,
      });

      const result = await customMCPHandler.callTool("function_tool", {
        message: "测试",
      });

      expect(result).toEqual({
        content: [{ type: "text", text: "处理结果: 测试" }],
        isError: false,
      });
    });

    it("应该处理函数工具调用错误", async () => {
      const functionTool: CustomMCPTool = {
        name: "error_function",
        description: "错误函数",
        inputSchema: {},
        handler: {
          type: "function",
          module: "./error-module.js",
          function: "errorFunction",
        } as FunctionHandlerConfig,
      };

      customMCPHandler.initialize([functionTool]);

      // Mock 抛出错误的函数
      vi.doMock("./error-module.js", () => ({
        errorFunction: () => {
          throw new Error("函数执行错误");
        },
      }));

      const result = await customMCPHandler.callTool("error_function", {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("函数工具调用失败");
    });

    it("应该处理模块加载错误", async () => {
      const functionTool: CustomMCPTool = {
        name: "invalid_module",
        description: "无效模块",
        inputSchema: {},
        handler: {
          type: "function",
          module: "./nonexistent-module.js",
          function: "testFunction",
        } as FunctionHandlerConfig,
      };

      customMCPHandler.initialize([functionTool]);

      const result = await customMCPHandler.callTool("invalid_module", {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("无法加载模块");
    });
  });

  describe("代理工具调用测试", () => {
    it("应该正确调用 Coze 代理工具", async () => {
      const cozeTool: CustomMCPTool = {
        name: "coze_tool",
        description: "Coze 工具",
        inputSchema: {},
        handler: {
          type: "proxy",
          platform: "coze",
          config: { workflow_id: "test_workflow" },
        } as ProxyHandlerConfig,
      };

      customMCPHandler.initialize([cozeTool]);

      // Mock callToolByType 方法
      vi.spyOn(customMCPHandler as any, "callToolByType").mockResolvedValue({
        content: [{ type: "text", text: "Coze 工作流执行成功" }],
        isError: false,
      });

      // 配置 Coze token
      mockCacheManager.loadExistingCache.mockResolvedValue({
        version: "1.0.0",
        mcpServers: {},
        metadata: {
          lastGlobalUpdate: new Date().toISOString(),
          totalWrites: 0,
          createdAt: new Date().toISOString(),
        },
        customMCPResults: {},
        cozeToken: "test_token",
      });

      const result = await customMCPHandler.callTool("coze_tool", {});

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain("Coze 工作流");
    });

    it("应该处理 Coze 工具调用错误", async () => {
      const cozeTool: CustomMCPTool = {
        name: "coze_error",
        description: "Coze 错误工具",
        inputSchema: {},
        handler: {
          type: "proxy",
          platform: "coze",
          config: { workflow_id: "test_workflow" },
        } as ProxyHandlerConfig,
      };

      customMCPHandler.initialize([cozeTool]);

      // Mock Coze API 错误
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve("Bad Request"),
      });

      const result = await customMCPHandler.callTool("coze_error", {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Coze 工作流调用失败");
    });

    it("应该拒绝不支持的代理平台", async () => {
      const unsupportedTool: CustomMCPTool = {
        name: "unsupported_platform",
        description: "不支持的平台",
        inputSchema: {},
        handler: {
          type: "proxy",
          platform: "unsupported" as any,
          config: {},
        } as ProxyHandlerConfig,
      };

      customMCPHandler.initialize([unsupportedTool]);

      await expect(
        customMCPHandler.callTool("unsupported_platform", {})
      ).rejects.toThrow("不支持的代理平台: unsupported");
    });
  });

  describe("HTTP 工具调用测试", () => {
    beforeEach(() => {
      // Mock fetch
      global.fetch = vi.fn();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("应该正确调用 HTTP 工具", async () => {
      const httpTool: CustomMCPTool = {
        name: "http_tool",
        description: "HTTP 工具",
        inputSchema: {},
        handler: {
          type: "http",
          url: "https://api.example.com/test",
          method: "POST",
          headers: { "Content-Type": "application/json" },
        } as HttpHandlerConfig,
      };

      customMCPHandler.initialize([httpTool]);

      (fetch as any).mockResolvedValue({
        ok: true,
        headers: { get: () => "application/json" },
        json: () => Promise.resolve({ success: true, data: "HTTP 调用成功" }),
      });

      const result = await customMCPHandler.callTool("http_tool", {});

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain("HTTP 调用成功");
    });

    it("应该处理 HTTP 工具调用错误", async () => {
      const httpTool: CustomMCPTool = {
        name: "http_error",
        description: "HTTP 错误工具",
        inputSchema: {},
        handler: {
          type: "http",
          url: "https://api.example.com/error",
          method: "POST",
        } as HttpHandlerConfig,
      };

      customMCPHandler.initialize([httpTool]);

      (fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        headers: { get: () => "text/plain" },
        text: () => Promise.resolve("Internal Server Error"),
      });

      const result = await customMCPHandler.callTool("http_error", {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("HTTP 请求失败");
    });

    it("应该处理 HTTP 工具超时", async () => {
      const httpTool: CustomMCPTool = {
        name: "http_timeout",
        description: "HTTP 超时工具",
        inputSchema: {},
        handler: {
          type: "http",
          url: "https://api.example.com/slow",
          timeout: 1000,
        } as HttpHandlerConfig,
      };

      customMCPHandler.initialize([httpTool]);

      (fetch as any).mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error("AbortError: timeout")), 1500);
        });
      });

      const result = await customMCPHandler.callTool("http_timeout", {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("timeout");
    });
  });

  describe("错误处理测试", () => {
    it("应该处理工具不存在错误", async () => {
      customMCPHandler.initialize([]);

      await expect(
        customMCPHandler.callTool("nonexistent_tool", {})
      ).rejects.toThrow("未找到工具: nonexistent_tool");
    });

    it("应该处理不支持的工具类型", async () => {
      const unsupportedTool: CustomMCPTool = {
        name: "unsupported_type",
        description: "不支持的类型",
        inputSchema: {},
        handler: { type: "unsupported" as any, config: {} },
      };

      customMCPHandler.initialize([unsupportedTool]);

      await expect(
        customMCPHandler.callTool("unsupported_type", {})
      ).rejects.toThrow("不支持的处理器类型: unsupported");
    });

    it("应该处理 MCP 类型工具路由错误", async () => {
      const mcpTool: CustomMCPTool = {
        name: "mcp_tool",
        description: "MCP 工具",
        inputSchema: {},
        handler: { type: "mcp", config: {} },
      };

      customMCPHandler.initialize([mcpTool]);

      const result = await customMCPHandler.callTool("mcp_tool", {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        "内部错误：MCP 类型工具路由错误"
      );
    });
  });

  describe("配置和选项测试", () => {
    it("应该支持自定义超时选项", async () => {
      const testTool: CustomMCPTool = {
        name: "timeout_test",
        description: "超时测试",
        inputSchema: {},
        handler: { type: "function", module: "test.js", function: "test" },
      };

      customMCPHandler.initialize([testTool]);

      // Mock 慢速函数
      vi.doMock("test.js", () => ({
        test: () => new Promise((resolve) => setTimeout(resolve, 5000)),
      }));

      const startTime = Date.now();
      const result = await customMCPHandler.callTool(
        "timeout_test",
        {},
        { timeout: 2000 }
      );
      const responseTime = Date.now() - startTime;

      expect(responseTime).toBeLessThan(3000); // 应该在2秒超时附近
    });

    it("应该兼容旧的调用方式", async () => {
      const testTool: CustomMCPTool = {
        name: "legacy_test",
        description: "兼容性测试",
        inputSchema: {},
        handler: { type: "function", module: "test.js", function: "legacy" },
      };

      customMCPHandler.initialize([testTool]);

      // Mock callToolByType 方法
      vi.spyOn(customMCPHandler as any, "callToolByType").mockResolvedValue({
        content: [{ type: "text", text: "legacy result" }],
        isError: false,
      });

      // 使用旧的调用方式（不带选项）
      const result = await customMCPHandler.callTool("legacy_test", {});

      expect(result).toEqual({
        content: [{ type: "text", text: "legacy result" }],
        isError: false,
      });
    });
  });

  describe("资源清理测试", () => {
    it("应该正确清理资源", () => {
      const testTool: CustomMCPTool = {
        name: "cleanup_test",
        description: "清理测试",
        inputSchema: {},
        handler: { type: "function", module: "test.js", function: "cleanup" },
      };

      customMCPHandler.initialize([testTool]);
      expect(customMCPHandler.getToolCount()).toBe(1);

      // 清理资源
      customMCPHandler.cleanup();
      expect(customMCPHandler.getToolCount()).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith(
        "[CustomMCP] 清理 CustomMCP 处理器资源"
      );
    });

    it("应该能够多次调用清理而不出错", () => {
      customMCPHandler.initialize([
        {
          name: "test",
          description: "test",
          inputSchema: {},
          handler: { type: "function", module: "test.js", function: "test" },
        },
      ]);

      // 多次调用清理
      customMCPHandler.cleanup();
      customMCPHandler.cleanup();
      customMCPHandler.cleanup();

      expect(customMCPHandler.getToolCount()).toBe(0);
    });
  });
});
