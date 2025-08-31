#!/usr/bin/env node

/**
 * CustomMCPHandler 单元测试
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomMCPTool } from "../../configManager.js";

// Mock configManager
vi.mock("../../configManager.js", () => ({
  configManager: {
    getCustomMCPTools: vi.fn(),
  },
}));

// Mock logger
vi.mock("../../Logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocking
const { CustomMCPHandler } = await import("../CustomMCPHandler.js");
const { configManager } = await import("../../configManager.js");
const { logger } = await import("../../Logger.js");

describe("CustomMCPHandler", () => {
  let handler: InstanceType<typeof CustomMCPHandler>;

  const mockProxyTool: CustomMCPTool = {
    name: "test_coze_workflow",
    description: "测试coze工作流是否正常可用",
    inputSchema: {
      type: "object",
      properties: {
        input: {
          type: "string",
          description: "用户说话的内容",
        },
      },
      required: ["input"],
    },
    handler: {
      type: "proxy",
      platform: "coze",
      config: {
        workflow_id: "7513776469241741352",
      },
    },
  };

  const mockFunctionTool: CustomMCPTool = {
    name: "test_function",
    description: "测试函数工具",
    inputSchema: {
      type: "object",
      properties: {
        value: {
          type: "number",
          description: "输入值",
        },
      },
      required: ["value"],
    },
    handler: {
      type: "function",
      function: "testFunction",
      module: "./test-module.js",
    },
  };

  const mockHttpTool: CustomMCPTool = {
    name: "test_http",
    description: "测试HTTP工具",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "查询参数",
        },
      },
      required: ["query"],
    },
    handler: {
      type: "http",
      url: "https://api.example.com/test",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    },
  };

  beforeEach(() => {
    handler = new CustomMCPHandler();
    vi.clearAllMocks();
  });

  describe("初始化", () => {
    it("应该成功初始化空的工具列表", () => {
      vi.mocked(configManager.getCustomMCPTools).mockReturnValue([]);

      handler.initialize();

      expect(configManager.getCustomMCPTools).toHaveBeenCalled();
      expect(handler.getToolCount()).toBe(0);
      expect(logger.info).toHaveBeenCalledWith(
        "[CustomMCP] 初始化完成，共加载 0 个工具"
      );
    });

    it("应该成功初始化并加载工具", () => {
      vi.mocked(configManager.getCustomMCPTools).mockReturnValue([
        mockProxyTool,
        mockFunctionTool,
      ]);

      handler.initialize();

      expect(handler.getToolCount()).toBe(2);
      expect(handler.hasTool("test_coze_workflow")).toBe(true);
      expect(handler.hasTool("test_function")).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(
        "[CustomMCP] 初始化完成，共加载 2 个工具"
      );
    });

    it("应该处理初始化错误", () => {
      const error = new Error("配置读取失败");
      vi.mocked(configManager.getCustomMCPTools).mockImplementation(() => {
        throw error;
      });

      expect(() => handler.initialize()).toThrow("配置读取失败");
      expect(logger.error).toHaveBeenCalledWith(
        "[CustomMCP] 初始化失败:",
        error
      );
    });
  });

  describe("工具管理", () => {
    beforeEach(() => {
      vi.mocked(configManager.getCustomMCPTools).mockReturnValue([
        mockProxyTool,
        mockFunctionTool,
        mockHttpTool,
      ]);
      handler.initialize();
    });

    it("应该返回正确的工具列表", () => {
      const tools = handler.getTools();

      expect(tools).toHaveLength(3);
      expect(tools[0]).toEqual({
        name: "test_coze_workflow",
        description: "测试coze工作流是否正常可用",
        inputSchema: mockProxyTool.inputSchema,
      });
    });

    it("应该正确检查工具是否存在", () => {
      expect(handler.hasTool("test_coze_workflow")).toBe(true);
      expect(handler.hasTool("test_function")).toBe(true);
      expect(handler.hasTool("nonexistent_tool")).toBe(false);
    });

    it("应该返回正确的工具数量", () => {
      expect(handler.getToolCount()).toBe(3);
    });

    it("应该返回所有工具名称", () => {
      const toolNames = handler.getToolNames();
      expect(toolNames).toEqual([
        "test_coze_workflow",
        "test_function",
        "test_http",
      ]);
    });

    it("应该返回工具详细信息", () => {
      const toolInfo = handler.getToolInfo("test_coze_workflow");
      expect(toolInfo).toEqual(mockProxyTool);
    });

    it("应该为不存在的工具返回 undefined", () => {
      const toolInfo = handler.getToolInfo("nonexistent_tool");
      expect(toolInfo).toBeUndefined();
    });
  });

  describe("工具调用", () => {
    beforeEach(() => {
      vi.mocked(configManager.getCustomMCPTools).mockReturnValue([
        mockProxyTool,
        mockFunctionTool,
        mockHttpTool,
      ]);
      handler.initialize();
    });

    it("应该拒绝调用不存在的工具", async () => {
      await expect(handler.callTool("nonexistent_tool", {})).rejects.toThrow(
        "未找到工具: nonexistent_tool"
      );
    });

    it("应该成功调用代理工具", async () => {
      const result = await handler.callTool("test_coze_workflow", {
        input: "测试输入",
      });

      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: expect.stringContaining("Coze 工作流调用功能正在开发中"),
          },
        ],
        isError: false,
      });
      expect(logger.info).toHaveBeenCalledWith(
        "[CustomMCP] 调用工具: test_coze_workflow",
        {
          handler: "proxy",
          arguments: { input: "测试输入" },
        }
      );
    });

    it("应该成功调用函数工具", async () => {
      const result = await handler.callTool("test_function", { value: 42 });

      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: expect.stringContaining("函数工具调用功能正在开发中"),
          },
        ],
        isError: false,
      });
    });

    it("应该成功调用HTTP工具", async () => {
      const result = await handler.callTool("test_http", { query: "test" });

      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: expect.stringContaining("HTTP 工具调用功能正在开发中"),
          },
        ],
        isError: false,
      });
    });

    it("应该处理不支持的处理器类型", async () => {
      const invalidTool: CustomMCPTool = {
        name: "invalid_tool",
        description: "无效工具",
        inputSchema: { type: "object" },
        handler: {
          type: "invalid" as any,
          // 添加必要的属性以满足 HandlerConfig 的要求
          platform: "coze",
          config: {},
        } as any,
      };

      vi.mocked(configManager.getCustomMCPTools).mockReturnValue([invalidTool]);
      handler.initialize();

      const result = await handler.callTool("invalid_tool", {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("不支持的处理器类型: invalid");
    });
  });

  describe("错误处理和重试", () => {
    beforeEach(() => {
      vi.mocked(configManager.getCustomMCPTools).mockReturnValue([
        mockProxyTool,
      ]);
      handler.initialize();
    });

    it("应该在工具调用失败时返回错误结果", async () => {
      // 创建一个会抛出错误的工具
      const errorTool: CustomMCPTool = {
        name: "error_tool",
        description: "会出错的工具",
        inputSchema: { type: "object" },
        handler: {
          type: "proxy",
          platform: "unknown_platform" as any,
          config: {},
        },
      };

      vi.mocked(configManager.getCustomMCPTools).mockReturnValue([errorTool]);
      handler.initialize();

      const result = await handler.callTool("error_tool", {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("工具调用失败");
    });

    it("应该支持自定义超时时间", async () => {
      const result = await handler.callTool(
        "test_coze_workflow",
        { input: "test" },
        { timeout: 5000 }
      );

      expect(result.isError).toBe(false);
      // 由于是模拟调用，不会真正超时，但会记录调用日志
      expect(logger.info).toHaveBeenCalledWith(
        "[CustomMCP] 调用工具: test_coze_workflow",
        {
          handler: "proxy",
          arguments: { input: "test" },
        }
      );
    });

    it("应该支持自定义重试次数", async () => {
      const result = await handler.callTool(
        "test_coze_workflow",
        { input: "test" },
        { retries: 1 }
      );

      expect(result.isError).toBe(false);
    });
  });

  describe("清理", () => {
    it("应该正确清理资源", () => {
      vi.mocked(configManager.getCustomMCPTools).mockReturnValue([
        mockProxyTool,
      ]);
      handler.initialize();

      expect(handler.getToolCount()).toBe(1);

      handler.cleanup();

      expect(handler.getToolCount()).toBe(0);
      expect(logger.info).toHaveBeenCalledWith(
        "[CustomMCP] 清理 CustomMCP 处理器资源"
      );
    });
  });
});
