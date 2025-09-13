import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToolSyncManager } from "../ToolSyncManager.js";
import type { ConfigManager } from "../../configManager.js";
import type { Logger } from "../../Logger.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { MCPToolConfig, CustomMCPTool } from "../../configManager.js";

// Mock ConfigManager
const createMockConfigManager = (): ConfigManager => {
  return {
    getServerToolsConfig: vi.fn(),
    getCustomMCPTools: vi.fn(),
    addCustomMCPTools: vi.fn(),
  } as unknown as ConfigManager;
};

// Mock Logger
const createMockLogger = (): Logger => {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    withTag: vi.fn().mockReturnThis(),
  } as unknown as Logger;
};

// Mock tools
const createMockTools = (names: string[]): Tool[] => {
  return names.map((name) => ({
    name,
    description: `Mock ${name} tool`,
    inputSchema: { type: "object", properties: {} },
  }));
};

// Mock tool configs
const createMockToolConfigs = (
  names: string[],
  enabled = true
): Record<string, MCPToolConfig> => {
  return names.reduce(
    (acc, name) => {
      acc[name] = {
        description: `Mock ${name} config`,
        enable: enabled,
        usageCount: 0,
      };
      return acc;
    },
    {} as Record<string, MCPToolConfig>
  );
};

// Mock custom MCP tools
const createMockCustomTools = (names: string[]): CustomMCPTool[] => {
  return names.map((name) => ({
    name,
    description: `Mock custom ${name} tool`,
    inputSchema: { type: "object", properties: {} },
    handler: {
      type: "proxy" as const,
      platform: "coze" as const,
      config: { workflow_id: "test" },
    },
  }));
};

describe("ToolSyncManager", () => {
  let toolSyncManager: ToolSyncManager;
  let mockConfigManager: ConfigManager;
  let mockLogger: Logger;

  beforeEach(() => {
    mockConfigManager = createMockConfigManager();
    mockLogger = createMockLogger();
    toolSyncManager = new ToolSyncManager(mockConfigManager, mockLogger);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("syncToolsAfterConnection", () => {
    it("应该跳过没有 mcpServerConfig 配置的服务", async () => {
      // Arrange
      const serviceName = "test-service";
      const tools = createMockTools(["tool1", "tool2"]);

      vi.mocked(mockConfigManager.getServerToolsConfig).mockReturnValue(
        {}
      );

      // Act
      await toolSyncManager.syncToolsAfterConnection(serviceName, tools);

      // Assert
      expect(mockConfigManager.getServerToolsConfig).toHaveBeenCalledWith(
        serviceName
      );
      expect(mockConfigManager.getCustomMCPTools).not.toHaveBeenCalled();
      expect(mockConfigManager.addCustomMCPTools).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `服务 ${serviceName} 无 mcpServerConfig 配置，跳过同步`
      );
    });

    it("应该跳过没有启用工具的服务", async () => {
      // Arrange
      const serviceName = "test-service";
      const tools = createMockTools(["tool1", "tool2"]);
      const serverConfig = createMockToolConfigs(["tool1", "tool2"], false);

      vi.mocked(mockConfigManager.getServerToolsConfig).mockReturnValue(
        serverConfig
      );
      vi.mocked(mockConfigManager.getCustomMCPTools).mockReturnValue([]);

      // Act
      await toolSyncManager.syncToolsAfterConnection(serviceName, tools);

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `服务 ${serviceName} 无启用工具，跳过同步`
      );
      expect(mockConfigManager.addCustomMCPTools).not.toHaveBeenCalled();
    });

    it("应该跳过所有工具已存在于 customMCP 的服务", async () => {
      // Arrange
      const serviceName = "test-service";
      const tools = createMockTools(["tool1", "tool2"]);
      const serverConfig = createMockToolConfigs(["tool1", "tool2"], true);
      const existingCustomTools = createMockCustomTools([
        `${serviceName}__tool1`,
        `${serviceName}__tool2`,
      ]);

      vi.mocked(mockConfigManager.getServerToolsConfig).mockReturnValue(
        serverConfig
      );
      vi.mocked(mockConfigManager.getCustomMCPTools).mockReturnValue(
        existingCustomTools
      );

      // Act
      await toolSyncManager.syncToolsAfterConnection(serviceName, tools);

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        `服务 ${serviceName} 的启用工具已存在于 customMCP 中，跳过同步`
      );
      expect(mockConfigManager.addCustomMCPTools).not.toHaveBeenCalled();
    });

    it("应该同步新工具到 customMCP", async () => {
      // Arrange
      const serviceName = "test-service";
      const tools = createMockTools(["tool1", "tool2", "tool3"]);
      const serverConfig = createMockToolConfigs(
        ["tool1", "tool2", "tool3"],
        true
      );
      const existingCustomTools = createMockCustomTools([
        `${serviceName}__tool1`, // tool1 已存在
        `${serviceName}__tool3`, // tool3 已存在
      ]);

      vi.mocked(mockConfigManager.getServerToolsConfig).mockReturnValue(
        serverConfig
      );
      vi.mocked(mockConfigManager.getCustomMCPTools).mockReturnValue(
        existingCustomTools
      );

      // Act
      await toolSyncManager.syncToolsAfterConnection(serviceName, tools);

      // Assert
      expect(mockConfigManager.addCustomMCPTools).toHaveBeenCalledWith([
        expect.objectContaining({
          name: `${serviceName}__tool2`,
          description: "Mock tool2 tool",
          inputSchema: { type: "object", properties: {} },
          handler: {
            type: "mcp",
            config: {
              serviceName,
              toolName: "tool2",
            },
          },
        }),
      ]);

      expect(mockLogger.info).toHaveBeenCalledWith(
        `成功同步服务 ${serviceName} 的 1 个工具到 customMCP`
      );
    });

    it("应该处理同步错误但不抛出异常", async () => {
      // Arrange
      const serviceName = "test-service";
      const tools = createMockTools(["tool1"]);
      const serverConfig = createMockToolConfigs(["tool1"], true);

      vi.mocked(mockConfigManager.getServerToolsConfig).mockReturnValue(
        serverConfig
      );
      vi.mocked(mockConfigManager.getCustomMCPTools).mockReturnValue([]);
      vi.mocked(mockConfigManager.addCustomMCPTools).mockRejectedValue(
        new Error("添加失败")
      );

      // Act
      await toolSyncManager.syncToolsAfterConnection(serviceName, tools);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        `同步服务 ${serviceName} 工具失败:`,
        expect.any(Error)
      );
      // 不应该抛出异常
    });

    it("应该防止同一服务的重复同步", async () => {
      // Arrange
      const serviceName = "test-service";
      const tools = createMockTools(["tool1"]);
      const serverConfig = createMockToolConfigs(["tool1"], true);

      vi.mocked(mockConfigManager.getServerToolsConfig).mockReturnValue(
        serverConfig
      );
      vi.mocked(mockConfigManager.getCustomMCPTools).mockReturnValue([]);
      vi.mocked(mockConfigManager.addCustomMCPTools).mockImplementation(
        async () => {
          // 模拟长时间运行的操作
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      );

      // Act - 同时调用两次
      const promise1 = toolSyncManager.syncToolsAfterConnection(
        serviceName,
        tools
      );
      const promise2 = toolSyncManager.syncToolsAfterConnection(
        serviceName,
        tools
      );

      await Promise.all([promise1, promise2]);

      // Assert
      expect(mockConfigManager.addCustomMCPTools).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `服务 ${serviceName} 正在同步中，跳过`
      );
    });
  });

  describe("getEnabledTools", () => {
    it("应该只返回启用的工具", () => {
      // Arrange
      const tools = createMockTools(["tool1", "tool2", "tool3"]);
      const serverConfig = {
        tool1: { enable: true, description: "Enabled tool" },
        tool2: { enable: false, description: "Disabled tool" },
        tool3: { enable: true, description: "Another enabled tool" },
      };

      // Act - 私有方法测试
      const enabledTools = (toolSyncManager as any).getEnabledTools(
        serverConfig,
        tools
      );

      // Assert
      expect(enabledTools).toHaveLength(2);
      expect(enabledTools.map((t: any) => t.name)).toEqual(["tool1", "tool3"]);
    });

    it("应该处理工具配置不存在的情况", () => {
      // Arrange
      const tools = createMockTools(["tool1", "tool2"]);
      const serverConfig = {
        tool1: { enable: true, description: "Enabled tool" },
        // tool2 配置不存在
      };

      // Act
      const enabledTools = (toolSyncManager as any).getEnabledTools(
        serverConfig,
        tools
      );

      // Assert
      expect(enabledTools).toHaveLength(1);
      expect(enabledTools[0].name).toBe("tool1");
    });
  });

  describe("addToolsToCustomMCP", () => {
    it("应该正确格式化工具并调用 configManager.addCustomMCPTools", async () => {
      // Arrange
      const serviceName = "test-service";
      const tools = createMockTools(["tool1", "tool2"]);

      // Act - 私有方法测试
      await (toolSyncManager as any).addToolsToCustomMCP(serviceName, tools);

      // Assert
      expect(mockConfigManager.addCustomMCPTools).toHaveBeenCalledWith([
        {
          name: `${serviceName}__tool1`,
          description: "Mock tool1 tool",
          inputSchema: { type: "object", properties: {} },
          handler: {
            type: "mcp",
            config: {
              serviceName,
              toolName: "tool1",
            },
          },
        },
        {
          name: `${serviceName}__tool2`,
          description: "Mock tool2 tool",
          inputSchema: { type: "object", properties: {} },
          handler: {
            type: "mcp",
            config: {
              serviceName,
              toolName: "tool2",
            },
          },
        },
      ]);
    });
  });

  describe("工具状态管理", () => {
    it("应该返回同步锁状态", () => {
      // Arrange
      const serviceName = "test-service";

      // Act
      const locks = toolSyncManager.getSyncLocks();

      // Assert
      expect(locks).toBeInstanceOf(Array);
      expect(locks).toHaveLength(0);
    });

    it("应该能够清理所有同步锁", () => {
      // Arrange
      (toolSyncManager as any).syncLocks.set("test-service", Promise.resolve());

      // Act
      toolSyncManager.clearSyncLocks();

      // Assert
      expect((toolSyncManager as any).syncLocks.size).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith("已清理所有同步锁");
    });
  });
});
