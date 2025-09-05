/**
 * ToolApiHandler customMCP 功能测试
 * 测试 customMCP 工具调用的特殊处理逻辑
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const mockMCPServiceManagerSingleton = {
  isInitialized: vi.fn(),
  getInstance: vi.fn(),
};

vi.mock("../services/MCPServiceManagerSingleton.js", () => ({
  MCPServiceManagerSingleton: mockMCPServiceManagerSingleton,
}));

vi.mock("../configManager.js", () => ({
  configManager: {
    getMcpServers: vi.fn(),
    getServerToolsConfig: vi.fn(),
  },
}));

vi.mock("../services/MCPServiceManagerSingleton.js", () => ({
  MCPServiceManagerSingleton: {
    isInitialized: vi.fn(),
    getInstance: vi.fn(),
  },
}));

describe("ToolApiHandler - customMCP 支持", () => {
  let toolApiHandler: ToolApiHandler;
  let mockServiceManager: any;
  let mockContext: any;

  beforeEach(() => {
    toolApiHandler = new ToolApiHandler();

    // Mock service manager
    mockServiceManager = {
      callTool: vi.fn(),
      hasCustomMCPTool: vi.fn(),
      getCustomMCPTools: vi.fn(),
      getService: vi.fn(),
      getAllTools: vi.fn(),
    };

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

  describe("callTool - customMCP 服务处理", () => {
    it("应该正确处理 customMCP 工具调用", async () => {
      // Arrange
      const requestBody = {
        serviceName: "customMCP",
        toolName: "test_coze_workflow",
        args: { input: "测试内容" },
      };

      const expectedResult = {
        content: [{ type: "text", text: "工具调用成功" }],
        isError: false,
      };

      mockContext.req.json.mockResolvedValue(requestBody);

      mockMCPServiceManagerSingleton.isInitialized.mockReturnValue(true);
      mockMCPServiceManagerSingleton.getInstance.mockResolvedValue(
        mockServiceManager
      );

      mockServiceManager.hasCustomMCPTool.mockReturnValue(true);
      mockServiceManager.getCustomMCPTools.mockReturnValue([
        { name: "test_coze_workflow", description: "测试工具" },
      ]);
      mockServiceManager.callTool.mockResolvedValue(expectedResult);

      // Act
      await toolApiHandler.callTool(mockContext);

      // Assert
      expect(mockServiceManager.hasCustomMCPTool).toHaveBeenCalledWith(
        "test_coze_workflow"
      );
      expect(mockServiceManager.callTool).toHaveBeenCalledWith(
        "test_coze_workflow",
        { input: "测试内容" }
      );
      expect(mockContext.json).toHaveBeenCalledWith({
        success: true,
        data: expectedResult,
        message: "工具调用成功",
      });
    });

    it("应该正确处理标准 MCP 工具调用", async () => {
      // Arrange
      const requestBody = {
        serviceName: "calculator",
        toolName: "calculator",
        args: { javascript_expression: "1+2" },
      };

      const expectedResult = {
        content: [{ type: "text", text: "3" }],
        isError: false,
      };

      mockContext.req.json.mockResolvedValue(requestBody);

      const { MCPServiceManagerSingleton } = await import(
        "../services/MCPServiceManagerSingleton.js"
      );
      const { configManager } = await import("../configManager.js");

      mockMCPServiceManagerSingleton.isInitialized.mockReturnValue(true);
      mockMCPServiceManagerSingleton.getInstance.mockResolvedValue(
        mockServiceManager
      );

      configManager.getMcpServers = vi.fn().mockReturnValue({
        calculator: { command: "node", args: ["./calculator.js"] },
      });
      configManager.getServerToolsConfig = vi.fn().mockReturnValue({
        calculator: { enable: true, description: "计算器" },
      });

      const mockService = {
        isConnected: vi.fn().mockReturnValue(true),
        getTools: vi
          .fn()
          .mockReturnValue([{ name: "calculator", description: "计算器工具" }]),
      };

      mockServiceManager.getService.mockReturnValue(mockService);
      mockServiceManager.callTool.mockResolvedValue(expectedResult);

      // Act
      await toolApiHandler.callTool(mockContext);

      // Assert
      expect(mockServiceManager.callTool).toHaveBeenCalledWith(
        "calculator__calculator",
        { javascript_expression: "1+2" }
      );
      expect(mockContext.json).toHaveBeenCalledWith({
        success: true,
        data: expectedResult,
        message: "工具调用成功",
      });
    });

    it("应该处理 customMCP 工具不存在的错误", async () => {
      // Arrange
      const requestBody = {
        serviceName: "customMCP",
        toolName: "nonexistent_tool",
        args: {},
      };

      mockContext.req.json.mockResolvedValue(requestBody);

      const { MCPServiceManagerSingleton } = await import(
        "../services/MCPServiceManagerSingleton.js"
      );
      (MCPServiceManagerSingleton.isInitialized as any).mockReturnValue(true);
      (MCPServiceManagerSingleton.getInstance as any)
        .fn()
        .mockResolvedValue(mockServiceManager);

      mockServiceManager.hasCustomMCPTool.mockReturnValue(false);
      mockServiceManager.getCustomMCPTools.mockReturnValue([
        { name: "test_coze_workflow", description: "测试工具" },
      ]);

      // Act
      await toolApiHandler.callTool(mockContext);

      // Assert
      expect(mockContext.json).toHaveBeenCalledWith(
        {
          success: false,
          error: {
            code: "SERVICE_OR_TOOL_NOT_FOUND",
            message:
              "customMCP 工具 'nonexistent_tool' 不存在。可用的 customMCP 工具: test_coze_workflow。请使用 'xiaozhi mcp list' 查看所有可用工具。",
          },
        },
        500
      );
    });

    it("应该处理缺少必需参数的错误", async () => {
      // Arrange
      const requestBody = {
        serviceName: "",
        toolName: "test_tool",
        args: {},
      };

      mockContext.req.json.mockResolvedValue(requestBody);

      // Act
      await toolApiHandler.callTool(mockContext);

      // Assert
      expect(mockContext.json).toHaveBeenCalledWith(
        {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "serviceName 和 toolName 是必需的参数",
          },
        },
        400
      );
    });

    it("应该处理服务管理器未初始化的错误", async () => {
      // Arrange
      const requestBody = {
        serviceName: "customMCP",
        toolName: "test_tool",
        args: {},
      };

      mockContext.req.json.mockResolvedValue(requestBody);

      const { MCPServiceManagerSingleton } = await import(
        "../services/MCPServiceManagerSingleton.js"
      );
      (MCPServiceManagerSingleton.isInitialized as any).mockReturnValue(false);

      // Act
      await toolApiHandler.callTool(mockContext);

      // Assert
      expect(mockContext.json).toHaveBeenCalledWith(
        {
          success: false,
          error: {
            code: "SERVICE_NOT_INITIALIZED",
            message: "MCP 服务管理器未初始化。请检查服务状态。",
          },
        },
        503
      );
    });
  });

  describe("listTools - customMCP 工具列表支持", () => {
    it("应该正确显示 customMCP 工具在工具列表中", async () => {
      // Arrange
      const mockCustomTools = [
        {
          name: "test_coze_workflow",
          description: "测试coze工作流",
          inputSchema: { type: "object" },
          serviceName: "customMCP",
          originalName: "test_coze_workflow",
        },
        {
          name: "another_custom_tool",
          description: "另一个自定义工具",
          inputSchema: { type: "object" },
          serviceName: "customMCP",
          originalName: "another_custom_tool",
        },
      ];

      const mockStandardTools = [
        {
          name: "calculator__calculator",
          description: "计算器工具",
          inputSchema: { type: "object" },
          serviceName: "calculator",
          originalName: "calculator",
        },
      ];

      const allTools = [...mockCustomTools, ...mockStandardTools];

      const { MCPServiceManagerSingleton } = await import(
        "../services/MCPServiceManagerSingleton.js"
      );
      (MCPServiceManagerSingleton.isInitialized as any).mockReturnValue(true);
      (MCPServiceManagerSingleton.getInstance as any)
        .fn()
        .mockResolvedValue(mockServiceManager);

      mockServiceManager.getAllTools.mockReturnValue(allTools);

      // Act
      await toolApiHandler.listTools(mockContext);

      // Assert
      expect(mockContext.json).toHaveBeenCalledWith({
        success: true,
        data: {
          totalTools: 3,
          services: {
            customMCP: [
              {
                name: "test_coze_workflow",
                fullName: "test_coze_workflow",
                description: "测试coze工作流",
                inputSchema: { type: "object" },
              },
              {
                name: "another_custom_tool",
                fullName: "another_custom_tool",
                description: "另一个自定义工具",
                inputSchema: { type: "object" },
              },
            ],
            calculator: [
              {
                name: "calculator",
                fullName: "calculator__calculator",
                description: "计算器工具",
                inputSchema: { type: "object" },
              },
            ],
          },
        },
        message: "获取工具列表成功",
      });
    });

    it("应该正确处理只有 customMCP 工具的情况", async () => {
      // Arrange
      const mockCustomTools = [
        {
          name: "test_tool",
          description: "测试工具",
          inputSchema: { type: "object" },
          serviceName: "customMCP",
          originalName: "test_tool",
        },
      ];

      const { MCPServiceManagerSingleton } = await import(
        "../services/MCPServiceManagerSingleton.js"
      );
      (MCPServiceManagerSingleton.isInitialized as any).mockReturnValue(true);
      (MCPServiceManagerSingleton.getInstance as any)
        .fn()
        .mockResolvedValue(mockServiceManager);

      mockServiceManager.getAllTools.mockReturnValue(mockCustomTools);

      // Act
      await toolApiHandler.listTools(mockContext);

      // Assert
      expect(mockContext.json).toHaveBeenCalledWith({
        success: true,
        data: {
          totalTools: 1,
          services: {
            customMCP: [
              {
                name: "test_tool",
                fullName: "test_tool",
                description: "测试工具",
                inputSchema: { type: "object" },
              },
            ],
          },
        },
        message: "获取工具列表成功",
      });
    });

    it("应该正确处理没有 customMCP 工具的情况", async () => {
      // Arrange
      const mockStandardTools = [
        {
          name: "calculator__calculator",
          description: "计算器工具",
          inputSchema: { type: "object" },
          serviceName: "calculator",
          originalName: "calculator",
        },
      ];

      const { MCPServiceManagerSingleton } = await import(
        "../services/MCPServiceManagerSingleton.js"
      );
      (MCPServiceManagerSingleton.isInitialized as any).mockReturnValue(true);
      (MCPServiceManagerSingleton.getInstance as any)
        .fn()
        .mockResolvedValue(mockServiceManager);

      mockServiceManager.getAllTools.mockReturnValue(mockStandardTools);

      // Act
      await toolApiHandler.listTools(mockContext);

      // Assert
      expect(mockContext.json).toHaveBeenCalledWith({
        success: true,
        data: {
          totalTools: 1,
          services: {
            calculator: [
              {
                name: "calculator",
                fullName: "calculator__calculator",
                description: "计算器工具",
                inputSchema: { type: "object" },
              },
            ],
          },
        },
        message: "获取工具列表成功",
      });
    });
  });

  describe("参数验证功能", () => {
    it("应该正确验证 customMCP 工具的必需参数", async () => {
      // Arrange
      const requestBody = {
        serviceName: "customMCP",
        toolName: "test_coze_workflow",
        args: {}, // 缺少必需的 input 参数
      };

      mockContext.req.json.mockResolvedValue(requestBody);

      const { MCPServiceManagerSingleton } = await import(
        "../services/MCPServiceManagerSingleton.js"
      );
      (MCPServiceManagerSingleton.isInitialized as any).mockReturnValue(true);
      (MCPServiceManagerSingleton.getInstance as any)
        .fn()
        .mockResolvedValue(mockServiceManager);

      mockServiceManager.hasCustomMCPTool.mockReturnValue(true);
      mockServiceManager.getCustomMCPTools.mockReturnValue([
        {
          name: "test_coze_workflow",
          description: "测试工具",
          inputSchema: {
            type: "object",
            properties: {
              input: {
                type: "string",
                description: "用户输入",
              },
            },
            required: ["input"],
          },
        },
      ]);

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

    it("应该正确验证 customMCP 工具的参数类型", async () => {
      // Arrange
      const requestBody = {
        serviceName: "customMCP",
        toolName: "test_coze_workflow",
        args: {
          input: 123, // 应该是 string 类型
        },
      };

      mockContext.req.json.mockResolvedValue(requestBody);

      const { MCPServiceManagerSingleton } = await import(
        "../services/MCPServiceManagerSingleton.js"
      );
      (MCPServiceManagerSingleton.isInitialized as any).mockReturnValue(true);
      (MCPServiceManagerSingleton.getInstance as any)
        .fn()
        .mockResolvedValue(mockServiceManager);

      mockServiceManager.hasCustomMCPTool.mockReturnValue(true);
      mockServiceManager.getCustomMCPTools.mockReturnValue([
        {
          name: "test_coze_workflow",
          description: "测试工具",
          inputSchema: {
            type: "object",
            properties: {
              input: {
                type: "string",
                description: "用户输入",
              },
            },
            required: ["input"],
          },
        },
      ]);

      // Act
      await toolApiHandler.callTool(mockContext);

      // Assert
      expect(mockContext.json).toHaveBeenCalledWith(
        {
          success: false,
          error: {
            code: "INVALID_ARGUMENTS",
            message: expect.stringContaining("类型错误"),
          },
        },
        500
      );
    });

    it("应该跳过没有 inputSchema 的 customMCP 工具的参数验证", async () => {
      // Arrange
      const requestBody = {
        serviceName: "customMCP",
        toolName: "test_tool_no_schema",
        args: { anyParam: "anyValue" },
      };

      const expectedResult = {
        content: [{ type: "text", text: "工具调用成功" }],
        isError: false,
      };

      mockContext.req.json.mockResolvedValue(requestBody);

      const { MCPServiceManagerSingleton } = await import(
        "../services/MCPServiceManagerSingleton.js"
      );
      (MCPServiceManagerSingleton.isInitialized as any).mockReturnValue(true);
      (MCPServiceManagerSingleton.getInstance as any)
        .fn()
        .mockResolvedValue(mockServiceManager);

      mockServiceManager.hasCustomMCPTool.mockReturnValue(true);
      mockServiceManager.getCustomMCPTools.mockReturnValue([
        {
          name: "test_tool_no_schema",
          description: "没有 schema 的测试工具",
          // 没有 inputSchema
        },
      ]);
      mockServiceManager.callTool.mockResolvedValue(expectedResult);

      // Act
      await toolApiHandler.callTool(mockContext);

      // Assert
      expect(mockServiceManager.callTool).toHaveBeenCalledWith(
        "test_tool_no_schema",
        { anyParam: "anyValue" }
      );
      expect(mockContext.json).toHaveBeenCalledWith({
        success: true,
        data: expectedResult,
        message: "工具调用成功",
      });
    });

    it("应该正确处理参数验证通过的情况", async () => {
      // Arrange
      const requestBody = {
        serviceName: "customMCP",
        toolName: "test_coze_workflow",
        args: {
          input: "正确的字符串参数",
        },
      };

      const expectedResult = {
        content: [{ type: "text", text: "工具调用成功" }],
        isError: false,
      };

      mockContext.req.json.mockResolvedValue(requestBody);

      const { MCPServiceManagerSingleton } = await import(
        "../services/MCPServiceManagerSingleton.js"
      );
      (MCPServiceManagerSingleton.isInitialized as any).mockReturnValue(true);
      (MCPServiceManagerSingleton.getInstance as any)
        .fn()
        .mockResolvedValue(mockServiceManager);

      mockServiceManager.hasCustomMCPTool.mockReturnValue(true);
      mockServiceManager.getCustomMCPTools.mockReturnValue([
        {
          name: "test_coze_workflow",
          description: "测试工具",
          inputSchema: {
            type: "object",
            properties: {
              input: {
                type: "string",
                description: "用户输入",
              },
            },
            required: ["input"],
          },
        },
      ]);
      mockServiceManager.callTool.mockResolvedValue(expectedResult);

      // Act
      await toolApiHandler.callTool(mockContext);

      // Assert
      expect(mockServiceManager.callTool).toHaveBeenCalledWith(
        "test_coze_workflow",
        { input: "正确的字符串参数" }
      );
      expect(mockContext.json).toHaveBeenCalledWith({
        success: true,
        data: expectedResult,
        message: "工具调用成功",
      });
    });
  });
});
