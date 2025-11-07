/**
 * MCPServiceManager customMCP 功能测试
 * 测试新增的 hasCustomMCPTool 和 getCustomMCPTools 方法
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MCPServiceManager from "./MCPServiceManager.js";

// Mock dependencies
vi.mock("../Logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    withTag: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../configManager.js", () => ({
  configManager: {
    getCustomMCPTools: vi.fn(),
    getMcpServers: vi.fn(),
    getToolCallLogConfig: vi.fn().mockReturnValue({
      maxRecords: 100,
    }),
    getConfigDir: vi.fn().mockReturnValue("/tmp"),
  },
}));

vi.mock("./CustomMCPHandler.js", () => ({
  CustomMCPHandler: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    hasTool: vi.fn(),
    getTools: vi.fn(),
    getToolCount: vi.fn(),
  })),
}));

vi.mock("./MCPCacheManager.js", () => ({
  MCPCacheManager: vi.fn().mockImplementation(() => ({
    loadCache: vi.fn(),
    saveCache: vi.fn(),
  })),
}));

vi.mock("../utils/ToolCallLogger.js", () => ({
  ToolCallLogger: vi.fn().mockImplementation(() => ({
    recordToolCall: vi.fn().mockResolvedValue(undefined),
    getLogFilePath: vi.fn().mockReturnValue("/tmp/tool-calls.jsonl"),
    getMaxRecords: vi.fn().mockReturnValue(100),
  })),
}));

describe("MCPServiceManager - customMCP 支持", () => {
  let serviceManager: MCPServiceManager;
  let mockCustomMCPHandler: any;

  beforeEach(() => {
    // Reset all mocks first
    vi.clearAllMocks();

    // Create service manager instance
    serviceManager = new MCPServiceManager();

    // Get the mocked CustomMCPHandler instance
    mockCustomMCPHandler = (serviceManager as any).customMCPHandler;

    // Ensure mock methods exist
    if (!mockCustomMCPHandler.hasTool) {
      mockCustomMCPHandler.hasTool = vi.fn();
    }
    if (!mockCustomMCPHandler.getTools) {
      mockCustomMCPHandler.getTools = vi.fn();
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("hasCustomMCPTool", () => {
    it("应该正确检查 customMCP 工具是否存在", () => {
      // Arrange
      const toolName = "test_coze_workflow";
      mockCustomMCPHandler.hasTool.mockReturnValue(true);

      // Act
      const result = serviceManager.hasCustomMCPTool(toolName);

      // Assert
      expect(result).toBe(true);
      expect(mockCustomMCPHandler.hasTool).toHaveBeenCalledWith(toolName);
    });

    it("应该正确返回工具不存在的情况", () => {
      // Arrange
      const toolName = "nonexistent_tool";
      mockCustomMCPHandler.hasTool.mockReturnValue(false);

      // Act
      const result = serviceManager.hasCustomMCPTool(toolName);

      // Assert
      expect(result).toBe(false);
      expect(mockCustomMCPHandler.hasTool).toHaveBeenCalledWith(toolName);
    });
  });

  describe("getCustomMCPTools", () => {
    it("应该正确返回 customMCP 工具列表", () => {
      // Arrange
      const expectedTools = [
        {
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
        },
        {
          name: "another_tool",
          description: "另一个测试工具",
          inputSchema: {
            type: "object",
            properties: {
              param: {
                type: "string",
                description: "参数",
              },
            },
          },
        },
      ];

      mockCustomMCPHandler.getTools.mockReturnValue(expectedTools);

      // Act
      const result = serviceManager.getCustomMCPTools();

      // Assert
      expect(result).toEqual(expectedTools);
      expect(mockCustomMCPHandler.getTools).toHaveBeenCalled();
    });

    it("应该正确处理空的工具列表", () => {
      // Arrange
      mockCustomMCPHandler.getTools.mockReturnValue([]);

      // Act
      const result = serviceManager.getCustomMCPTools();

      // Assert
      expect(result).toEqual([]);
      expect(mockCustomMCPHandler.getTools).toHaveBeenCalled();
    });
  });

  describe("集成测试", () => {
    it("应该正确集成 customMCP 工具到整体工具管理中", () => {
      // Arrange
      const customTools = [
        {
          name: "custom_tool_1",
          description: "自定义工具1",
          inputSchema: { type: "object" },
        },
        {
          name: "custom_tool_2",
          description: "自定义工具2",
          inputSchema: { type: "object" },
        },
      ];

      mockCustomMCPHandler.hasTool.mockImplementation((toolName: string) => {
        return customTools.some((tool) => tool.name === toolName);
      });
      mockCustomMCPHandler.getTools.mockReturnValue(customTools);

      // Act & Assert - 测试工具存在检查
      expect(serviceManager.hasCustomMCPTool("custom_tool_1")).toBe(true);
      expect(serviceManager.hasCustomMCPTool("custom_tool_2")).toBe(true);
      expect(serviceManager.hasCustomMCPTool("nonexistent_tool")).toBe(false);

      // Act & Assert - 测试工具列表获取
      const tools = serviceManager.getCustomMCPTools();
      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe("custom_tool_1");
      expect(tools[1].name).toBe("custom_tool_2");
    });

    it("应该正确处理 CustomMCPHandler 初始化失败的情况", () => {
      // Arrange
      mockCustomMCPHandler.hasTool.mockImplementation(() => {
        throw new Error("CustomMCPHandler 未初始化");
      });

      // Act
      const result = serviceManager.hasCustomMCPTool("test_tool");

      // Assert - 应该返回 false 而不是抛出异常
      expect(result).toBe(false);
      expect(mockCustomMCPHandler.hasTool).toHaveBeenCalledWith("test_tool");
    });
  });

  describe("边界情况测试", () => {
    it("应该正确处理特殊字符的工具名称", () => {
      // Arrange
      const specialToolName = "tool-with_special.chars@123";
      mockCustomMCPHandler.hasTool.mockReturnValue(true);

      // Act
      const result = serviceManager.hasCustomMCPTool(specialToolName);

      // Assert
      expect(result).toBe(true);
      expect(mockCustomMCPHandler.hasTool).toHaveBeenCalledWith(
        specialToolName
      );
    });

    it("应该正确处理空字符串工具名称", () => {
      // Arrange
      const emptyToolName = "";
      mockCustomMCPHandler.hasTool.mockReturnValue(false);

      // Act
      const result = serviceManager.hasCustomMCPTool(emptyToolName);

      // Assert
      expect(result).toBe(false);
      expect(mockCustomMCPHandler.hasTool).toHaveBeenCalledWith(emptyToolName);
    });

    it("应该正确处理工具列表中包含不完整数据的情况", () => {
      // Arrange
      const incompleteTools = [
        {
          name: "complete_tool",
          description: "完整的工具",
          inputSchema: { type: "object" },
        },
        {
          name: "incomplete_tool",
          // 缺少 description
          inputSchema: { type: "object" },
        } as any,
      ];

      mockCustomMCPHandler.getTools.mockReturnValue(incompleteTools);

      // Act
      const result = serviceManager.getCustomMCPTools();

      // Assert
      expect(result).toEqual(incompleteTools);
      expect(result).toHaveLength(2);
    });
  });
});
