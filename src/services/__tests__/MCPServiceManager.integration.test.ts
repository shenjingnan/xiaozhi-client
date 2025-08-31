#!/usr/bin/env node

/**
 * MCPServiceManager 与 CustomMCP 集成测试
 * 测试 customMCP 工具与标准 MCP 工具的混合使用
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MCPServiceConfig } from "../MCPService.js";

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

// Mock MCPService
const mockMCPService = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  isConnected: vi.fn(),
  getTools: vi.fn(),
  callTool: vi.fn(),
  getStatus: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
};

vi.mock("../MCPService.js", () => ({
  MCPService: vi.fn().mockImplementation(() => mockMCPService),
  MCPTransportType: {
    STDIO: "stdio",
    SSE: "sse",
    MODELSCOPE_SSE: "modelscope-sse",
    STREAMABLE_HTTP: "streamable-http",
  },
}));

// Import after mocking
const { MCPServiceManager } = await import("../MCPServiceManager.js");
const { configManager } = await import("../../configManager.js");

describe("MCPServiceManager CustomMCP 集成测试", () => {
  let manager: InstanceType<typeof MCPServiceManager>;

  const mockCustomMCPTool = {
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
      type: "proxy" as const,
      platform: "coze",
      config: {
        workflow_id: "7513776469241741352",
      },
    },
  };

  const mockStandardTool = {
    name: "standard_tool",
    description: "标准 MCP 工具",
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
  };

  beforeEach(() => {
    manager = new MCPServiceManager();
    vi.clearAllMocks();

    // 设置默认的 mock 返回值
    vi.mocked(configManager.getCustomMCPTools).mockReturnValue([
      mockCustomMCPTool,
    ]);
    vi.mocked(configManager.isToolEnabled).mockReturnValue(true);
    vi.mocked(configManager.hasValidCustomMCPTools).mockReturnValue(true);
    vi.mocked(configManager.validateCustomMCPTools).mockReturnValue(true);

    // 设置 MCPService mock
    mockMCPService.connect.mockResolvedValue(undefined);
    mockMCPService.disconnect.mockResolvedValue(undefined);
    mockMCPService.isConnected.mockReturnValue(true);
    mockMCPService.getTools.mockReturnValue([mockStandardTool]);
    mockMCPService.callTool.mockResolvedValue({
      content: [{ type: "text", text: "标准工具调用结果" }],
    });
    mockMCPService.getStatus.mockReturnValue({ connected: true });
  });

  describe("服务启动和初始化", () => {
    it("应该同时初始化 CustomMCP 处理器和标准 MCP 服务", async () => {
      const serviceConfig: MCPServiceConfig = {
        name: "test-service",
        type: "stdio" as any,
        command: "test-command",
      };

      manager.addServiceConfig("test-service", serviceConfig);
      await manager.startAllServices();

      // 验证 CustomMCP 处理器被初始化
      expect(configManager.getCustomMCPTools).toHaveBeenCalled();

      // 验证标准 MCP 服务被启动
      expect(mockMCPService.connect).toHaveBeenCalled();
    });

    it("应该在 CustomMCP 初始化失败时继续启动标准 MCP 服务", async () => {
      vi.mocked(configManager.getCustomMCPTools).mockImplementation(() => {
        throw new Error("CustomMCP 初始化失败");
      });

      const serviceConfig: MCPServiceConfig = {
        name: "test-service",
        type: "stdio" as any,
        command: "test-command",
      };

      manager.addServiceConfig("test-service", serviceConfig);
      await manager.startAllServices();

      // 验证标准 MCP 服务仍然被启动
      expect(mockMCPService.connect).toHaveBeenCalled();
    });
  });

  describe("工具聚合", () => {
    it("应该返回合并后的工具列表（包含 customMCP 和标准 MCP 工具）", async () => {
      const serviceConfig: MCPServiceConfig = {
        name: "test-service",
        type: "stdio" as any,
        command: "test-command",
      };

      manager.addServiceConfig("test-service", serviceConfig);
      await manager.startAllServices();

      const allTools = manager.getAllTools();

      // 应该包含 customMCP 工具
      const customTool = allTools.find(
        (tool) => tool.name === "test_coze_workflow"
      );
      expect(customTool).toBeDefined();
      expect(customTool?.serviceName).toBe("customMCP");
      expect(customTool?.description).toBe("测试coze工作流是否正常可用");

      // 应该包含标准 MCP 工具（工具名会添加服务名前缀）
      const standardTool = allTools.find(
        (tool) => tool.name === "test-service__standard_tool"
      );
      expect(standardTool).toBeDefined();
      expect(standardTool?.serviceName).toBe("test-service");
      expect(standardTool?.description).toBe("标准 MCP 工具");
      expect(standardTool?.originalName).toBe("standard_tool");
    });

    it("应该在 CustomMCP 工具获取失败时仍返回标准 MCP 工具", async () => {
      // 模拟 CustomMCP 工具获取失败
      const customMCPHandler = manager.getCustomMCPHandler();
      vi.spyOn(customMCPHandler, "getTools").mockImplementation(() => {
        throw new Error("获取 CustomMCP 工具失败");
      });

      const serviceConfig: MCPServiceConfig = {
        name: "test-service",
        type: "stdio" as any,
        command: "test-command",
      };

      manager.addServiceConfig("test-service", serviceConfig);
      await manager.startAllServices();

      const allTools = manager.getAllTools();

      // 应该只包含标准 MCP 工具
      expect(allTools).toHaveLength(1);
      expect(allTools[0].name).toBe("test-service__standard_tool");
      expect(allTools[0].serviceName).toBe("test-service");
      expect(allTools[0].originalName).toBe("standard_tool");
    });
  });

  describe("工具调用路由", () => {
    beforeEach(async () => {
      const serviceConfig: MCPServiceConfig = {
        name: "test-service",
        type: "stdio" as any,
        command: "test-command",
      };

      manager.addServiceConfig("test-service", serviceConfig);
      await manager.startAllServices();
    });

    it("应该正确路由 customMCP 工具调用", async () => {
      const result = await manager.callTool("test_coze_workflow", {
        input: "测试输入",
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain("Coze 工作流调用功能正在开发中");
    });

    it("应该正确路由标准 MCP 工具调用", async () => {
      const result = await manager.callTool("test-service__standard_tool", {
        query: "测试查询",
      });

      expect(result).toBeDefined();
      expect(result.content[0].text).toBe("标准工具调用结果");
      expect(mockMCPService.callTool).toHaveBeenCalledWith("standard_tool", {
        query: "测试查询",
      });
    });

    it("应该为不存在的工具抛出错误", async () => {
      await expect(manager.callTool("nonexistent_tool", {})).rejects.toThrow(
        "未找到工具: nonexistent_tool"
      );
    });
  });

  describe("工具检查", () => {
    beforeEach(async () => {
      const serviceConfig: MCPServiceConfig = {
        name: "test-service",
        type: "stdio" as any,
        command: "test-command",
      };

      manager.addServiceConfig("test-service", serviceConfig);
      await manager.startAllServices();
    });

    it("应该正确检查 customMCP 工具是否存在", () => {
      expect(manager.hasTool("test_coze_workflow")).toBe(true);
    });

    it("应该正确检查标准 MCP 工具是否存在", () => {
      expect(manager.hasTool("test-service__standard_tool")).toBe(true);
    });

    it("应该为不存在的工具返回 false", () => {
      expect(manager.hasTool("nonexistent_tool")).toBe(false);
    });
  });

  describe("状态管理", () => {
    it("应该在状态中包含 customMCP 和标准 MCP 服务", async () => {
      const serviceConfig: MCPServiceConfig = {
        name: "test-service",
        type: "stdio" as any,
        command: "test-command",
      };

      manager.addServiceConfig("test-service", serviceConfig);
      await manager.startAllServices();

      const status = manager.getStatus();

      // 应该包含标准 MCP 服务
      expect(status.services["test-service"]).toBeDefined();
      expect(status.services["test-service"].connected).toBe(true);
      expect(status.services["test-service"].clientName).toBe(
        "xiaozhi-test-service-client"
      );

      // 应该包含 customMCP 服务
      expect(status.services.customMCP).toBeDefined();
      expect(status.services.customMCP.connected).toBe(true);
      expect(status.services.customMCP.clientName).toBe(
        "xiaozhi-customMCP-handler"
      );

      // 总工具数应该包含两种类型的工具
      expect(status.totalTools).toBe(2); // 1 个 customMCP 工具 + 1 个标准工具
      expect(status.availableTools).toContain("test_coze_workflow");
      expect(status.availableTools).toContain("test-service__standard_tool");
    });

    it("应该在没有 customMCP 工具时不包含 customMCP 服务状态", async () => {
      vi.mocked(configManager.getCustomMCPTools).mockReturnValue([]);

      const serviceConfig: MCPServiceConfig = {
        name: "test-service",
        type: "stdio" as any,
        command: "test-command",
      };

      manager.addServiceConfig("test-service", serviceConfig);
      await manager.startAllServices();

      const status = manager.getStatus();

      // 不应该包含 customMCP 服务
      expect(status.services.customMCP).toBeUndefined();

      // 应该只包含标准 MCP 服务的工具
      expect(status.totalTools).toBe(1);
      expect(status.availableTools).toEqual(["test-service__standard_tool"]);
    });
  });

  describe("服务停止和清理", () => {
    it("应该同时清理 customMCP 处理器和标准 MCP 服务", async () => {
      const serviceConfig: MCPServiceConfig = {
        name: "test-service",
        type: "stdio" as any,
        command: "test-command",
      };

      manager.addServiceConfig("test-service", serviceConfig);
      await manager.startAllServices();

      const customMCPHandler = manager.getCustomMCPHandler();
      const cleanupSpy = vi.spyOn(customMCPHandler, "cleanup");

      await manager.stopAllServices();

      // 验证 CustomMCP 处理器被清理
      expect(cleanupSpy).toHaveBeenCalled();

      // 验证标准 MCP 服务被断开
      expect(mockMCPService.disconnect).toHaveBeenCalled();
    });
  });
});
