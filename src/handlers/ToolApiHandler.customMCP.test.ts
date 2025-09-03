/**
 * ToolApiHandler customMCP 功能测试
 * 测试 customMCP 工具调用的特殊处理逻辑
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
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
      
      const { MCPServiceManagerSingleton } = await import("../services/MCPServiceManagerSingleton.js");
      MCPServiceManagerSingleton.isInitialized = vi.fn().mockReturnValue(true);
      MCPServiceManagerSingleton.getInstance = vi.fn().mockResolvedValue(mockServiceManager);

      mockServiceManager.hasCustomMCPTool.mockReturnValue(true);
      mockServiceManager.getCustomMCPTools.mockReturnValue([
        { name: "test_coze_workflow", description: "测试工具" }
      ]);
      mockServiceManager.callTool.mockResolvedValue(expectedResult);

      // Act
      await toolApiHandler.callTool(mockContext);

      // Assert
      expect(mockServiceManager.hasCustomMCPTool).toHaveBeenCalledWith("test_coze_workflow");
      expect(mockServiceManager.callTool).toHaveBeenCalledWith("test_coze_workflow", { input: "测试内容" });
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
      
      const { MCPServiceManagerSingleton } = await import("../services/MCPServiceManagerSingleton.js");
      const { configManager } = await import("../configManager.js");
      
      MCPServiceManagerSingleton.isInitialized = vi.fn().mockReturnValue(true);
      MCPServiceManagerSingleton.getInstance = vi.fn().mockResolvedValue(mockServiceManager);
      
      configManager.getMcpServers = vi.fn().mockReturnValue({
        calculator: { command: "node", args: ["./calculator.js"] }
      });
      configManager.getServerToolsConfig = vi.fn().mockReturnValue({
        calculator: { enable: true, description: "计算器" }
      });

      const mockService = {
        isConnected: vi.fn().mockReturnValue(true),
        getTools: vi.fn().mockReturnValue([
          { name: "calculator", description: "计算器工具" }
        ]),
      };

      mockServiceManager.getService.mockReturnValue(mockService);
      mockServiceManager.callTool.mockResolvedValue(expectedResult);

      // Act
      await toolApiHandler.callTool(mockContext);

      // Assert
      expect(mockServiceManager.callTool).toHaveBeenCalledWith("calculator__calculator", { javascript_expression: "1+2" });
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
      
      const { MCPServiceManagerSingleton } = await import("../services/MCPServiceManagerSingleton.js");
      MCPServiceManagerSingleton.isInitialized = vi.fn().mockReturnValue(true);
      MCPServiceManagerSingleton.getInstance = vi.fn().mockResolvedValue(mockServiceManager);

      mockServiceManager.hasCustomMCPTool.mockReturnValue(false);
      mockServiceManager.getCustomMCPTools.mockReturnValue([
        { name: "test_coze_workflow", description: "测试工具" }
      ]);

      // Act
      await toolApiHandler.callTool(mockContext);

      // Assert
      expect(mockContext.json).toHaveBeenCalledWith(
        {
          success: false,
          error: {
            code: "SERVICE_OR_TOOL_NOT_FOUND",
            message: "customMCP 工具 'nonexistent_tool' 不存在。可用工具: test_coze_workflow",
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
      
      const { MCPServiceManagerSingleton } = await import("../services/MCPServiceManagerSingleton.js");
      MCPServiceManagerSingleton.isInitialized = vi.fn().mockReturnValue(false);

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
});
