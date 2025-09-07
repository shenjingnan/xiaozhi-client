/**
 * ToolApiHandler 集成测试
 * 测试 customMCP 工具调用的完整集成场景
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { configManager } from "../configManager.js";
import type { MCPServiceManager } from "../services/MCPServiceManager.js";
import { MCPServiceManagerSingleton } from "../services/MCPServiceManagerSingleton.js";
import { ToolApiHandler } from "./ToolApiHandler.js";

// Mock dependencies
vi.mock("../Logger.js", () => ({
  logger: {
    withTag: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));

describe("ToolApiHandler - 集成测试", () => {
  let toolApiHandler: ToolApiHandler;
  let mockContext: any;
  let originalConfig: any;

  beforeAll(() => {
    // 保存原始配置
    originalConfig = {
      getCustomMCPTools: configManager.getCustomMCPTools,
      hasValidCustomMCPTools: configManager.hasValidCustomMCPTools,
    };
  });

  afterAll(() => {
    // 恢复原始配置
    Object.assign(configManager, originalConfig);
  });

  beforeEach(() => {
    toolApiHandler = new ToolApiHandler();

    // Mock Hono context
    mockContext = {
      req: {
        json: vi.fn(),
      },
      json: vi.fn(),
    };

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("不同类型的 customMCP handler 测试", () => {
    it("应该支持 proxy 类型的 handler", async () => {
      // Arrange
      const proxyToolConfig = {
        name: "test_proxy_tool",
        description: "测试代理工具",
        inputSchema: {
          type: "object",
          properties: {
            input: { type: "string" },
          },
          required: ["input"],
        },
        handler: {
          type: "proxy",
          platform: "coze",
          config: {
            workflow_id: "test_workflow_id",
          },
        },
      };

      const requestBody = {
        serviceName: "customMCP",
        toolName: "test_proxy_tool",
        args: { input: "测试输入" },
      };

      mockContext.req.json.mockResolvedValue(requestBody);

      // Mock configManager
      configManager.getCustomMCPTools = vi
        .fn()
        .mockReturnValue([proxyToolConfig]);
      configManager.hasValidCustomMCPTools = vi.fn().mockReturnValue(true);

      // Mock MCPServiceManager
      const mockServiceManager = {
        hasCustomMCPTool: vi.fn().mockReturnValue(true),
        getCustomMCPTools: vi.fn().mockReturnValue([proxyToolConfig]),
        callTool: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "代理工具调用成功" }],
          isError: false,
        }),
      };

      vi.spyOn(MCPServiceManagerSingleton, "isInitialized").mockReturnValue(
        true
      );
      vi.spyOn(MCPServiceManagerSingleton, "getInstance").mockResolvedValue(
        mockServiceManager as unknown as MCPServiceManager
      );

      // Act
      await toolApiHandler.callTool(mockContext);

      // Assert
      expect(mockServiceManager.callTool).toHaveBeenCalledWith(
        "test_proxy_tool",
        { input: "测试输入" }
      );
      expect(mockContext.json).toHaveBeenCalledWith({
        success: true,
        data: {
          content: [{ type: "text", text: "代理工具调用成功" }],
          isError: false,
        },
        message: "工具调用成功",
      });
    });

    it("应该支持 http 类型的 handler", async () => {
      // Arrange
      const httpToolConfig = {
        name: "test_http_tool",
        description: "测试HTTP工具",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string" },
            method: { type: "string", enum: ["GET", "POST"] },
          },
          required: ["url"],
        },
        handler: {
          type: "http",
          config: {
            url: "https://api.example.com/test",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          },
        },
      };

      const requestBody = {
        serviceName: "customMCP",
        toolName: "test_http_tool",
        args: { url: "https://test.com", method: "GET" },
      };

      mockContext.req.json.mockResolvedValue(requestBody);

      // Mock configManager
      configManager.getCustomMCPTools = vi
        .fn()
        .mockReturnValue([httpToolConfig]);

      // Mock MCPServiceManager
      const mockServiceManager = {
        hasCustomMCPTool: vi.fn().mockReturnValue(true),
        getCustomMCPTools: vi.fn().mockReturnValue([httpToolConfig]),
        callTool: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "HTTP工具调用成功" }],
          isError: false,
        }),
      };

      vi.spyOn(MCPServiceManagerSingleton, "isInitialized").mockReturnValue(
        true
      );
      vi.spyOn(MCPServiceManagerSingleton, "getInstance").mockResolvedValue(
        mockServiceManager as unknown as MCPServiceManager
      );

      // Act
      await toolApiHandler.callTool(mockContext);

      // Assert
      expect(mockServiceManager.callTool).toHaveBeenCalledWith(
        "test_http_tool",
        { url: "https://test.com", method: "GET" }
      );
      expect(mockContext.json).toHaveBeenCalledWith({
        success: true,
        data: {
          content: [{ type: "text", text: "HTTP工具调用成功" }],
          isError: false,
        },
        message: "工具调用成功",
      });
    });

    it("应该支持 function 类型的 handler", async () => {
      // Arrange
      const functionToolConfig = {
        name: "test_function_tool",
        description: "测试函数工具",
        inputSchema: {
          type: "object",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
          },
          required: ["x", "y"],
        },
        handler: {
          type: "function",
          config: {
            code: "function add(x, y) { return x + y; }",
            functionName: "add",
          },
        },
      };

      const requestBody = {
        serviceName: "customMCP",
        toolName: "test_function_tool",
        args: { x: 5, y: 3 },
      };

      mockContext.req.json.mockResolvedValue(requestBody);

      // Mock configManager
      configManager.getCustomMCPTools = vi
        .fn()
        .mockReturnValue([functionToolConfig]);

      // Mock MCPServiceManager
      const mockServiceManager = {
        hasCustomMCPTool: vi.fn().mockReturnValue(true),
        getCustomMCPTools: vi.fn().mockReturnValue([functionToolConfig]),
        callTool: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "8" }],
          isError: false,
        }),
      };

      vi.spyOn(MCPServiceManagerSingleton, "isInitialized").mockReturnValue(
        true
      );
      vi.spyOn(MCPServiceManagerSingleton, "getInstance").mockResolvedValue(
        mockServiceManager as unknown as MCPServiceManager
      );

      // Act
      await toolApiHandler.callTool(mockContext);

      // Assert
      expect(mockServiceManager.callTool).toHaveBeenCalledWith(
        "test_function_tool",
        { x: 5, y: 3 }
      );
      expect(mockContext.json).toHaveBeenCalledWith({
        success: true,
        data: {
          content: [{ type: "text", text: "8" }],
          isError: false,
        },
        message: "工具调用成功",
      });
    });
  });

  describe("参数验证边界情况测试", () => {
    it("应该正确处理复杂的 JSON Schema 验证", async () => {
      // Arrange
      const complexToolConfig = {
        name: "complex_validation_tool",
        description: "复杂参数验证工具",
        inputSchema: {
          type: "object",
          properties: {
            user: {
              type: "object",
              properties: {
                name: { type: "string", minLength: 2, maxLength: 50 },
                age: { type: "integer", minimum: 0, maximum: 150 },
                email: { type: "string" },
              },
              required: ["name", "age"],
            },
            preferences: {
              type: "array",
              items: {
                type: "string",
                enum: ["option1", "option2", "option3"],
              },
              minItems: 1,
              maxItems: 3,
            },
          },
          required: ["user"],
        },
        handler: {
          type: "function",
          config: {
            code: "function process(data) { return 'processed'; }",
            functionName: "process",
          },
        },
      };

      const requestBody = {
        serviceName: "customMCP",
        toolName: "complex_validation_tool",
        args: {
          user: {
            name: "A", // 太短，应该失败
            age: 25,
          },
        },
      };

      mockContext.req.json.mockResolvedValue(requestBody);

      // Mock configManager
      configManager.getCustomMCPTools = vi
        .fn()
        .mockReturnValue([complexToolConfig]);

      // Mock MCPServiceManager
      const mockServiceManager = {
        hasCustomMCPTool: vi.fn().mockReturnValue(true),
        getCustomMCPTools: vi.fn().mockReturnValue([complexToolConfig]),
      };

      vi.spyOn(MCPServiceManagerSingleton, "isInitialized").mockReturnValue(
        true
      );
      vi.spyOn(MCPServiceManagerSingleton, "getInstance").mockResolvedValue(
        mockServiceManager as unknown as MCPServiceManager
      );

      // Act
      await toolApiHandler.callTool(mockContext);

      // Assert
      expect(mockContext.json).toHaveBeenCalledWith(
        {
          success: false,
          error: {
            code: "INVALID_ARGUMENTS",
            message: expect.stringContaining("参数验证失败"),
          },
        },
        500
      );
    });

    it("应该正确处理嵌套对象的参数验证", async () => {
      // Arrange
      const nestedToolConfig = {
        name: "nested_validation_tool",
        description: "嵌套参数验证工具",
        inputSchema: {
          type: "object",
          properties: {
            config: {
              type: "object",
              properties: {
                database: {
                  type: "object",
                  properties: {
                    host: { type: "string" },
                    port: { type: "integer", minimum: 1, maximum: 65535 },
                  },
                  required: ["host", "port"],
                },
              },
              required: ["database"],
            },
          },
          required: ["config"],
        },
        handler: {
          type: "function",
          config: {
            code: "function connect(config) { return 'connected'; }",
            functionName: "connect",
          },
        },
      };

      const requestBody = {
        serviceName: "customMCP",
        toolName: "nested_validation_tool",
        args: {
          config: {
            database: {
              host: "localhost",
              port: 3306,
            },
          },
        },
      };

      mockContext.req.json.mockResolvedValue(requestBody);

      // Mock configManager
      configManager.getCustomMCPTools = vi
        .fn()
        .mockReturnValue([nestedToolConfig]);

      // Mock MCPServiceManager
      const mockServiceManager = {
        hasCustomMCPTool: vi.fn().mockReturnValue(true),
        getCustomMCPTools: vi.fn().mockReturnValue([nestedToolConfig]),
        callTool: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "connected" }],
          isError: false,
        }),
      };

      vi.spyOn(MCPServiceManagerSingleton, "isInitialized").mockReturnValue(
        true
      );
      vi.spyOn(MCPServiceManagerSingleton, "getInstance").mockResolvedValue(
        mockServiceManager as unknown as MCPServiceManager
      );

      // Act
      await toolApiHandler.callTool(mockContext);

      // Assert
      expect(mockServiceManager.callTool).toHaveBeenCalledWith(
        "nested_validation_tool",
        {
          config: {
            database: {
              host: "localhost",
              port: 3306,
            },
          },
        }
      );
      expect(mockContext.json).toHaveBeenCalledWith({
        success: true,
        data: {
          content: [{ type: "text", text: "connected" }],
          isError: false,
        },
        message: "工具调用成功",
      });
    });
  });
});
