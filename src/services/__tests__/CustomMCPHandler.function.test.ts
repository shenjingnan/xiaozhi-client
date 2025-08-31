#!/usr/bin/env node

/**
 * CustomMCPHandler 函数处理器测试
 * 测试函数工具的各种场景
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FunctionHandlerConfig } from "../../configManager.js";
import { CustomMCPHandler } from "../CustomMCPHandler.js";

// Mock configManager
vi.mock("../../configManager.js", () => ({
  configManager: {
    getCustomMCPTools: vi.fn(),
    isToolEnabled: vi.fn(),
    hasValidCustomMCPTools: vi.fn(),
    validateCustomMCPTools: vi.fn(),
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

// Mock dynamic import
const mockModuleExports = {
  default: vi.fn(),
  testFunction: vi.fn(),
  asyncFunction: vi.fn(),
};

vi.mock("node:url", () => ({
  URL: vi.fn().mockImplementation((path, base) => ({
    href: `${base}${path}`,
  })),
}));

// Mock import function
const originalImport = (global as any).import;
const mockImport = vi.fn();
(global as any).import = mockImport;

describe("CustomMCPHandler 函数处理器测试", () => {
  let handler: CustomMCPHandler;

  const mockFunctionTool = {
    name: "test_function",
    description: "测试函数调用",
    inputSchema: {
      type: "object",
      properties: {
        input: {
          type: "string",
          description: "输入参数",
        },
      },
      required: ["input"],
    },
    handler: {
      type: "function" as const,
      module: "./test-module.js",
      function: "testFunction",
      timeout: 30000,
      context: {
        config: "test-config",
      },
    } as FunctionHandlerConfig,
  };

  const mockDefaultFunctionTool = {
    name: "test_default_function",
    description: "测试默认导出函数",
    inputSchema: {
      type: "object",
      properties: {
        data: {
          type: "any",
          description: "数据参数",
        },
      },
    },
    handler: {
      type: "function" as const,
      module: "./default-module.js",
      function: "default",
      timeout: 5000,
    } as FunctionHandlerConfig,
  };

  beforeEach(() => {
    handler = new CustomMCPHandler();
    vi.clearAllMocks();

    // 重置 mock 函数
    mockModuleExports.default.mockReset();
    mockModuleExports.testFunction.mockReset();
    mockModuleExports.asyncFunction.mockReset();
  });

  describe("函数加载和调用", () => {
    it("应该成功加载模块并调用命名导出函数", async () => {
      mockModuleExports.testFunction.mockReturnValue("函数执行结果");
      mockImport.mockResolvedValueOnce(mockModuleExports);

      handler.initialize([mockFunctionTool]);

      const result = await handler.callTool("test_function", {
        input: "测试输入",
      });

      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toBe("函数执行结果");

      // 验证函数被正确调用
      expect(mockModuleExports.testFunction).toHaveBeenCalledWith(
        { input: "测试输入" },
        expect.objectContaining({
          config: "test-config",
          logger: expect.any(Object),
          arguments: { input: "测试输入" },
        })
      );
    });

    it("应该成功调用默认导出函数", async () => {
      mockModuleExports.default.mockReturnValue("默认函数结果");
      mockImport.mockResolvedValueOnce(mockModuleExports);

      handler.initialize([mockDefaultFunctionTool]);

      const result = await handler.callTool("test_default_function", {
        data: { key: "value" },
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe("默认函数结果");

      // 验证默认函数被调用
      expect(mockModuleExports.default).toHaveBeenCalledWith({
        data: { key: "value" },
      });
    });

    it("应该处理异步函数", async () => {
      mockModuleExports.asyncFunction.mockResolvedValue("异步函数结果");

      const asyncTool = {
        ...mockFunctionTool,
        handler: {
          ...mockFunctionTool.handler,
          function: "asyncFunction",
        },
      };

      mockImport.mockResolvedValueOnce(mockModuleExports);

      handler.initialize([asyncTool]);

      const result = await handler.callTool("test_function", {
        input: "异步测试",
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe("异步函数结果");
    });

    it("应该处理返回对象的函数", async () => {
      const complexResult = {
        status: "success",
        data: ["item1", "item2"],
        metadata: { count: 2 },
      };

      mockModuleExports.testFunction.mockReturnValue(complexResult);
      mockImport.mockResolvedValueOnce(mockModuleExports);

      handler.initialize([mockFunctionTool]);

      const result = await handler.callTool("test_function", {
        input: "复杂测试",
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe(
        JSON.stringify(complexResult, null, 2)
      );
    });
  });

  describe("错误处理", () => {
    it("应该处理模块加载失败", async () => {
      mockImport.mockRejectedValueOnce(new Error("模块不存在"));

      handler.initialize([mockFunctionTool]);

      const result = await handler.callTool("test_function", {
        input: "测试",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("无法加载模块");
      expect(result.content[0].text).toContain("模块不存在");
    });

    it("应该处理函数不存在的情况", async () => {
      const moduleWithoutFunction = {
        otherFunction: vi.fn(),
      };

      mockImport.mockResolvedValueOnce(moduleWithoutFunction);

      handler.initialize([mockFunctionTool]);

      const result = await handler.callTool("test_function", {
        input: "测试",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        "在模块中找不到函数: testFunction"
      );
    });

    it("应该处理函数执行异常", async () => {
      mockModuleExports.testFunction.mockImplementation(() => {
        throw new Error("函数执行错误");
      });

      mockImport.mockResolvedValueOnce(mockModuleExports);

      handler.initialize([mockFunctionTool]);

      const result = await handler.callTool("test_function", {
        input: "测试",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("函数工具调用失败");
      expect(result.content[0].text).toContain("函数执行错误");
    });

    it("应该处理异步函数异常", async () => {
      mockModuleExports.asyncFunction.mockRejectedValue(
        new Error("异步函数错误")
      );

      const asyncTool = {
        ...mockFunctionTool,
        handler: {
          ...mockFunctionTool.handler,
          function: "asyncFunction",
        },
      };

      mockImport.mockResolvedValueOnce(mockModuleExports);

      handler.initialize([asyncTool]);

      const result = await handler.callTool("test_function", {
        input: "异步测试",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("异步函数错误");
    });

    it("应该处理函数执行超时", async () => {
      mockModuleExports.testFunction.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve("延迟结果"), 200);
        });
      });

      const timeoutTool = {
        ...mockFunctionTool,
        handler: {
          ...mockFunctionTool.handler,
          timeout: 100, // 很短的超时时间
        },
      };

      mockImport.mockResolvedValueOnce(mockModuleExports);

      handler.initialize([timeoutTool]);

      const result = await handler.callTool("test_function", {
        input: "超时测试",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("函数执行超时");
    });
  });

  describe("参数和上下文处理", () => {
    it("应该为单参数函数只传递参数", async () => {
      const singleParamFunction = vi.fn().mockReturnValue("单参数结果");

      const moduleExports = {
        singleParam: singleParamFunction,
      };

      const singleParamTool = {
        ...mockFunctionTool,
        handler: {
          ...mockFunctionTool.handler,
          function: "singleParam",
        },
      };

      mockImport.mockResolvedValueOnce(moduleExports);

      handler.initialize([singleParamTool]);

      await handler.callTool("test_function", { input: "测试" });

      // 验证只传递了参数，没有上下文
      expect(singleParamFunction).toHaveBeenCalledWith({ input: "测试" });
      expect(singleParamFunction).toHaveBeenCalledTimes(1);
    });

    it("应该为多参数函数传递参数和上下文", async () => {
      mockModuleExports.testFunction.mockReturnValue("多参数结果");
      mockImport.mockResolvedValueOnce(mockModuleExports);

      handler.initialize([mockFunctionTool]);

      await handler.callTool("test_function", { input: "测试" });

      // 验证传递了参数和上下文
      expect(mockModuleExports.testFunction).toHaveBeenCalledWith(
        { input: "测试" },
        expect.objectContaining({
          config: "test-config",
          logger: expect.any(Object),
          arguments: { input: "测试" },
        })
      );
    });

    it("应该处理没有上下文配置的情况", async () => {
      const noContextTool = {
        ...mockFunctionTool,
        handler: {
          ...mockFunctionTool.handler,
          context: undefined,
        },
      };

      mockModuleExports.testFunction.mockReturnValue("无上下文结果");
      mockImport.mockResolvedValueOnce(mockModuleExports);

      handler.initialize([noContextTool]);

      await handler.callTool("test_function", { input: "测试" });

      // 验证上下文只包含默认字段
      expect(mockModuleExports.testFunction).toHaveBeenCalledWith(
        { input: "测试" },
        expect.objectContaining({
          logger: expect.any(Object),
          arguments: { input: "测试" },
        })
      );

      const context = mockModuleExports.testFunction.mock.calls[0][1];
      expect(context.config).toBeUndefined();
    });
  });

  describe("模块路径处理", () => {
    it("应该处理相对路径", async () => {
      mockImport.mockResolvedValueOnce(mockModuleExports);
      mockModuleExports.testFunction.mockReturnValue("相对路径结果");

      handler.initialize([mockFunctionTool]);

      await handler.callTool("test_function", { input: "测试" });

      // 验证 import 被调用时使用了正确的路径
      expect(mockImport).toHaveBeenCalledWith(
        expect.stringContaining("./test-module.js")
      );
    });

    it("应该处理绝对路径", async () => {
      const absolutePathTool = {
        ...mockFunctionTool,
        handler: {
          ...mockFunctionTool.handler,
          module: "/absolute/path/to/module.js",
        },
      };

      mockImport.mockResolvedValueOnce(mockModuleExports);
      mockModuleExports.testFunction.mockReturnValue("绝对路径结果");

      handler.initialize([absolutePathTool]);

      await handler.callTool("test_function", { input: "测试" });

      expect(mockImport).toHaveBeenCalledWith("/absolute/path/to/module.js");
    });

    it("应该处理 file:// URL", async () => {
      const fileUrlTool = {
        ...mockFunctionTool,
        handler: {
          ...mockFunctionTool.handler,
          module: "file:///path/to/module.js",
        },
      };

      mockImport.mockResolvedValueOnce(mockModuleExports);
      mockModuleExports.testFunction.mockReturnValue("文件URL结果");

      handler.initialize([fileUrlTool]);

      await handler.callTool("test_function", { input: "测试" });

      expect(mockImport).toHaveBeenCalledWith("file:///path/to/module.js");
    });
  });

  afterAll(() => {
    // 恢复原始的 import 函数
    (global as any).import = originalImport;
  });
});
