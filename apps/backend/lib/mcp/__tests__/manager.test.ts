/**
 * MCPServiceManager customMCP 功能测试
 * 测试新增的 hasCustomMCPTool 和 getCustomMCPTools 方法
 */

import { MCPServiceManager } from "@/lib/mcp";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { Logger } from "@root/Logger.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@root/Logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    withTag: vi.fn().mockReturnValue({
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
    }),
  },
}));

vi.mock("@root/configManager.js", () => ({
  configManager: {
    getCustomMCPTools: vi.fn(),
    getMcpServers: vi.fn(),
    getToolCallLogConfig: vi.fn().mockReturnValue({
      maxRecords: 100,
    }),
    getConfigDir: vi.fn().mockReturnValue("/tmp"),
  },
}));

vi.mock("@root/services/ToolSyncManager.js", () => ({
  ToolSyncManager: vi.fn().mockImplementation(() => ({
    syncToolsAfterConnection: vi.fn(),
  })),
}));

vi.mock("@root/services/CustomMCPHandler.js", () => ({
  CustomMCPHandler: vi.fn().mockImplementation(() => {
    // 创建所有需要的Mock方法
    const mockMethods = {
      // 基础方法
      initialize: vi.fn(),
      reinitialize: vi.fn(),
      hasTool: vi.fn(),
      getTools: vi.fn(),
      getToolCount: vi.fn(),
      getToolNames: vi.fn(),
      getToolInfo: vi.fn(),

      // 工具调用方法
      callTool: vi.fn(),

      // 资源管理方法
      cleanup: vi.fn(),
      stopCleanupTimer: vi.fn(),

      // 管理器集成方法
      getCacheLifecycleManager: vi.fn(),
      getTaskStateManager: vi.fn(),
      getCacheStatistics: vi.fn(),
      getTaskStatistics: vi.fn(),
      getTaskStatus: vi.fn(),
      validateTaskId: vi.fn(),
      restartStalledTasks: vi.fn(),
      manualCleanupCache: vi.fn(),
      validateSystemIntegrity: vi.fn(),
    };

    return mockMethods;
  }),
}));

vi.mock("@root/services/MCPCacheManager.js", () => ({
  MCPCacheManager: vi.fn().mockImplementation(() => ({
    loadCache: vi.fn(),
    saveCache: vi.fn(),
  })),
}));

vi.mock("@utils/ToolCallLogger.js", () => ({
  ToolCallLogger: vi.fn().mockImplementation(() => ({
    recordToolCall: vi.fn().mockResolvedValue(undefined),
    getLogFilePath: vi.fn().mockReturnValue("/tmp/tool-calls.jsonl"),
    getMaxRecords: vi.fn().mockReturnValue(100),
  })),
}));

describe("MCPServiceManager - customMCP 支持", () => {
  let serviceManager: MCPServiceManager;
  let mockCustomMCPHandler: {
    initialize: ReturnType<typeof vi.fn>;
    reinitialize: ReturnType<typeof vi.fn>;
    hasTool: ReturnType<typeof vi.fn>;
    getTools: ReturnType<typeof vi.fn>;
    getToolCount: ReturnType<typeof vi.fn>;
    getToolNames: ReturnType<typeof vi.fn>;
    getToolInfo: ReturnType<typeof vi.fn>;
    callTool: ReturnType<typeof vi.fn>;
    cleanup: ReturnType<typeof vi.fn>;
    stopCleanupTimer: ReturnType<typeof vi.fn>;
    getCacheLifecycleManager: ReturnType<typeof vi.fn>;
    getTaskStateManager: ReturnType<typeof vi.fn>;
    getCacheStatistics: ReturnType<typeof vi.fn>;
    getTaskStatistics: ReturnType<typeof vi.fn>;
    getTaskStatus: ReturnType<typeof vi.fn>;
    validateTaskId: ReturnType<typeof vi.fn>;
    restartStalledTasks: ReturnType<typeof vi.fn>;
    manualCleanupCache: ReturnType<typeof vi.fn>;
    validateSystemIntegrity: ReturnType<typeof vi.fn>;
    [key: string]: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Reset all mocks first
    vi.clearAllMocks();

    // Create service manager instance
    serviceManager = new MCPServiceManager();

    // Get the mocked CustomMCPHandler instance
    mockCustomMCPHandler = (
      serviceManager as unknown as {
        customMCPHandler: typeof mockCustomMCPHandler;
      }
    ).customMCPHandler;

    // Ensure all required mock methods exist with complete default behavior
    const requiredMethods = [
      "initialize",
      "reinitialize",
      "hasTool",
      "getTools",
      "getToolCount",
      "getToolNames",
      "getToolInfo",
      "callTool",
      "cleanup",
      "stopCleanupTimer",
      "getCacheLifecycleManager",
      "getTaskStateManager",
      "getCacheStatistics",
      "getTaskStatistics",
      "getTaskStatus",
      "validateTaskId",
      "restartStalledTasks",
      "manualCleanupCache",
      "validateSystemIntegrity",
    ];

    for (const methodName of requiredMethods) {
      if (!mockCustomMCPHandler[methodName]) {
        mockCustomMCPHandler[methodName] = vi.fn();
      }
    }

    // 设置合理的默认返回值
    mockCustomMCPHandler.hasTool.mockReturnValue(false);
    mockCustomMCPHandler.getTools.mockReturnValue([]);
    mockCustomMCPHandler.getToolCount.mockReturnValue(0);
    mockCustomMCPHandler.getToolNames.mockReturnValue([]);
    mockCustomMCPHandler.getToolInfo.mockReturnValue(undefined);
    mockCustomMCPHandler.callTool.mockResolvedValue({
      content: [{ type: "text", text: "Mock response" }],
      isError: false,
    });
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
        } as Tool,
      ];

      mockCustomMCPHandler.getTools.mockReturnValue(incompleteTools);

      // Act
      const result = serviceManager.getCustomMCPTools();

      // Assert
      expect(result).toEqual(incompleteTools);
      expect(result).toHaveLength(2);
    });
  });

  describe("错误处理和边界情况", () => {
    it("应该正确处理 CustomMCPHandler 完全未初始化的情况", () => {
      // Arrange - 模拟 CustomMCPHandler 完全不存在
      (
        serviceManager as unknown as { customMCPHandler: null }
      ).customMCPHandler = null;

      // Act & Assert - 应该优雅地处理而不是抛出异常
      expect(() => {
        serviceManager.hasCustomMCPTool("test_tool");
      }).not.toThrow();

      expect(() => {
        serviceManager.getCustomMCPTools();
      }).not.toThrow();
    });

    it("应该正确处理方法调用抛出异常的情况", () => {
      // Arrange
      mockCustomMCPHandler.hasTool.mockImplementation(() => {
        throw new Error("Handler 内部错误");
      });

      // Act
      const result = serviceManager.hasCustomMCPTool("test_tool");

      // Assert - 应该返回 false 而不是抛出异常
      expect(result).toBe(false);
    });

    it("应该正确处理 getTools 方法抛出异常的情况", () => {
      // Arrange
      mockCustomMCPHandler.getTools.mockImplementation(() => {
        throw new Error("获取工具列表失败");
      });

      // Act
      const result = serviceManager.getCustomMCPTools();

      // Assert - 应该返回空数组而不是抛出异常
      expect(result).toEqual([]);
    });
  });
});

describe("MCPServiceManager - Logger 注入功能", () => {
  let serviceManager: MCPServiceManager;
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    withTag: ReturnType<typeof vi.fn>;
  };
  let mockCustomMCPHandler: {
    hasTool: ReturnType<typeof vi.fn>;
    getTools: ReturnType<typeof vi.fn>;
    [key: string]: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Reset all mocks first
    vi.clearAllMocks();

    // 创建简单的 mock logger 实例
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      withTag: vi.fn().mockReturnThis(),
    };

    // Create service manager instance
    serviceManager = new MCPServiceManager();

    // Get the mocked CustomMCPHandler instance
    mockCustomMCPHandler = (
      serviceManager as unknown as {
        customMCPHandler: typeof mockCustomMCPHandler;
      }
    ).customMCPHandler;

    // 确保必要方法存在
    if (!mockCustomMCPHandler.hasTool) {
      mockCustomMCPHandler.hasTool = vi.fn();
    }
    if (!mockCustomMCPHandler.getTools) {
      mockCustomMCPHandler.getTools = vi.fn();
    }

    // 设置默认返回值
    mockCustomMCPHandler.hasTool.mockReturnValue(false);
    mockCustomMCPHandler.getTools.mockReturnValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("基本功能测试", () => {
    it("应该支持构造函数注入 logger", () => {
      // Act & Assert - 不应该抛出异常
      expect(() => {
        serviceManager = new MCPServiceManager(
          undefined,
          mockLogger as unknown as Logger
        );
      }).not.toThrow();
    });

    it("应该支持不传 logger 的构造函数调用", () => {
      // Act & Assert - 不应该抛出异常
      expect(() => {
        serviceManager = new MCPServiceManager();
      }).not.toThrow();
    });

    it("应该支持 setLogger 方法", () => {
      // Arrange
      serviceManager = new MCPServiceManager();

      // Act & Assert - 不应该抛出异常
      expect(() => {
        serviceManager.setLogger(mockLogger as unknown as Logger);
      }).not.toThrow();
    });

    it("应该支持 getLogger 方法", () => {
      // Arrange
      serviceManager = new MCPServiceManager(
        undefined,
        mockLogger as unknown as Logger
      );

      // Act & Assert - 不应该抛出异常
      expect(() => {
        const logger = serviceManager.getLogger();
        expect(logger).toBeDefined();
      }).not.toThrow();
    });

    it("应该正确注入和使用 logger", () => {
      // Arrange
      serviceManager = new MCPServiceManager(
        undefined,
        mockLogger as unknown as Logger
      );

      // Act & Assert - logger 应该被正确注入
      expect(() => {
        const currentLogger = serviceManager.getLogger();
        expect(currentLogger).toBeDefined();
      }).not.toThrow();
    });
  });

  describe("向后兼容性测试", () => {
    it("应该与现有的 API 完全兼容", () => {
      // Arrange - 设置完整的 Mock 响应（使用当前实例的 customMCPHandler）
      mockCustomMCPHandler.hasTool.mockReturnValue(true);
      mockCustomMCPHandler.getTools.mockReturnValue([
        {
          name: "test_custom_tool",
          description: "测试自定义工具",
          inputSchema: { type: "object" },
        },
      ]);

      // 使用当前的 serviceManager 实例，不重新创建
      // serviceManager 已经在 beforeEach 中创建了

      // Assert - 所有现有方法应该正常工作
      expect(() => {
        // 这些方法可能会内部调用 customMCPHandler 的各种方法
        serviceManager.getAllTools();
        serviceManager.hasTool("test_tool");
        serviceManager.hasCustomMCPTool("test_custom_tool");
        serviceManager.getCustomMCPTools();
        serviceManager.getServiceManagerStatus();
      }).not.toThrow();

      // 验证具体的方法调用结果
      expect(serviceManager.hasCustomMCPTool("test_custom_tool")).toBe(true);
      expect(serviceManager.getCustomMCPTools()).toHaveLength(1);
    });
  });
});
