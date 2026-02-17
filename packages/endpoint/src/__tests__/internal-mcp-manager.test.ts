/**
 * InternalMCPManagerAdapter 单元测试
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EnhancedToolInfo, ToolCallResult } from "../types.js";
import { InternalMCPManagerAdapter } from "../internal-mcp-manager.js";

// Mock 依赖
vi.mock("@xiaozhi-client/mcp-core", () => ({
  MCPManager: vi.fn(),
  ensureToolJSONSchema: vi.fn((schema: unknown) => schema),
}));

vi.mock("@xiaozhi-client/config", () => ({
  normalizeServiceConfig: vi.fn(),
}));

describe("InternalMCPManagerAdapter", () => {
  let mockMCPManager: any;
  let mockConvertLegacyToNew: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // 获取 mock 函数
    const mcpCore = await import("@xiaozhi-client/mcp-core");
    const MCPManagerMock = mcpCore.MCPManager;

    const configModule = await import("@xiaozhi-client/config");
    mockConvertLegacyToNew = configModule.normalizeServiceConfig as any;

    // 设置 mock MCPManager
    mockMCPManager = {
      addServer: vi.fn(),
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      listTools: vi.fn().mockReturnValue([]),
      callTool: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "Success" }],
      }),
      on: vi.fn(),
    };

    MCPManagerMock.mockImplementation(() => mockMCPManager);

    // 设置 mock normalizeServiceConfig
    // 重构后接受单个对象参数 { name, ...config }，返回不含 name 的配置
    mockConvertLegacyToNew.mockImplementation((input: any) => {
      const { name, ...config } = input;
      return config;
    });
  });

  describe("构造函数", () => {
    it("应该创建适配器实例", () => {
      const config = {
        mcpServers: {
          "test-service": {
            command: "node",
            args: ["server.js"],
          },
        },
      };

      const adapter = new InternalMCPManagerAdapter(config);
      expect(adapter).toBeInstanceOf(InternalMCPManagerAdapter);
    });

    it("应该为每个 MCP 服务调用 MCPManager.addServer", () => {
      const config = {
        mcpServers: {
          "service1": { command: "node", args: ["s1.js"] },
          "service2": { url: "https://example.com/sse" },
        },
      };

      new InternalMCPManagerAdapter(config);

      expect(mockMCPManager.addServer).toHaveBeenCalledTimes(2);
      expect(mockMCPManager.addServer).toHaveBeenCalledWith("service1", expect.any(Object));
      expect(mockMCPManager.addServer).toHaveBeenCalledWith("service2", expect.any(Object));
    });

    it("应该设置事件监听器", () => {
      const config = {
        mcpServers: {
          "test-service": { command: "node", args: ["server.js"] },
        },
      };

      new InternalMCPManagerAdapter(config);

      expect(mockMCPManager.on).toHaveBeenCalledWith("connected", expect.any(Function));
      expect(mockMCPManager.on).toHaveBeenCalledWith("error", expect.any(Function));
    });

    it("应该正确转换配置", () => {
      const config = {
        mcpServers: {
          "test-service": {
            url: "https://example.com/sse",
          },
        },
      };

      new InternalMCPManagerAdapter(config);

      // 直接调用 normalizeServiceConfig 转换配置
      expect(mockConvertLegacyToNew).toHaveBeenCalledWith({
        url: "https://example.com/sse",
      });
    });
  });

  describe("initialize", () => {
    it("应该成功初始化", async () => {
      const adapter = new InternalMCPManagerAdapter({
        mcpServers: {
          "test-service": { command: "node", args: ["server.js"] },
        },
      });

      await adapter.initialize();

      expect(mockMCPManager.connect).toHaveBeenCalled();
    });

    it("应该只初始化一次", async () => {
      const adapter = new InternalMCPManagerAdapter({
        mcpServers: {
          "test-service": { command: "node", args: ["server.js"] },
        },
      });

      await adapter.initialize();
      await adapter.initialize();

      expect(mockMCPManager.connect).toHaveBeenCalledTimes(1);
    });

    it("应该刷新工具列表", async () => {
      mockMCPManager.listTools.mockReturnValue([
        {
          serverName: "test-service",
          name: "tool1",
          description: "测试工具",
          inputSchema: { type: "object" },
        },
      ]);

      const adapter = new InternalMCPManagerAdapter({
        mcpServers: {
          "test-service": { command: "node", args: ["server.js"] },
        },
      });

      await adapter.initialize();

      const tools = adapter.getAllTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe("test-service__tool1");
    });

    it("应该处理空的工具列表", async () => {
      mockMCPManager.listTools.mockReturnValue([]);

      const adapter = new InternalMCPManagerAdapter({
        mcpServers: {
          "test-service": { command: "node", args: ["server.js"] },
        },
      });

      await adapter.initialize();

      const tools = adapter.getAllTools();
      expect(tools).toHaveLength(0);
    });
  });

  describe("getAllTools", () => {
    it("初始化前应该返回空数组", () => {
      const adapter = new InternalMCPManagerAdapter({
        mcpServers: {
          "test-service": { command: "node", args: ["server.js"] },
        },
      });

      const tools = adapter.getAllTools();
      expect(tools).toEqual([]);
    });

    it("初始化后应该返回工具列表", async () => {
      mockMCPManager.listTools.mockReturnValue([
        {
          serverName: "test-service",
          name: "tool1",
          description: "测试工具 1",
          inputSchema: { type: "object" },
        },
        {
          serverName: "test-service",
          name: "tool2",
          description: "测试工具 2",
          inputSchema: { type: "object" },
        },
      ]);

      const adapter = new InternalMCPManagerAdapter({
        mcpServers: {
          "test-service": { command: "node", args: ["server.js"] },
        },
      });

      await adapter.initialize();

      const tools = adapter.getAllTools();
      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe("test-service__tool1");
      expect(tools[1].name).toBe("test-service__tool2");
    });

    it("应该正确设置工具属性", async () => {
      mockMCPManager.listTools.mockReturnValue([
        {
          serverName: "test-service",
          name: "tool1",
          description: "测试工具",
          inputSchema: { type: "object", properties: {} },
        },
      ]);

      const adapter = new InternalMCPManagerAdapter({
        mcpServers: {
          "test-service": { command: "node", args: ["server.js"] },
        },
      });

      await adapter.initialize();

      const tools = adapter.getAllTools();
      const tool = tools[0] as EnhancedToolInfo;

      expect(tool.name).toBe("test-service__tool1");
      expect(tool.description).toBe("测试工具");
      expect(tool.serviceName).toBe("test-service");
      expect(tool.originalName).toBe("tool1");
      expect(tool.enabled).toBe(true);
      expect(tool.usageCount).toBe(0);
      expect(tool.lastUsedTime).toBeDefined();
    });
  });

  describe("callTool", () => {
    it("应该成功调用工具", async () => {
      mockMCPManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "结果" }],
      });

      const adapter = new InternalMCPManagerAdapter({
        mcpServers: {
          "test-service": { command: "node", args: ["server.js"] },
        },
      });

      const result = await adapter.callTool("test-service__tool1", { param: "value" });

      expect(mockMCPManager.callTool).toHaveBeenCalledWith(
        "test-service",
        "tool1",
        { param: "value" }
      );
      expect(result).toEqual({
        content: [{ type: "text", text: "结果" }],
      });
    });

    it("应该处理包含 __ 的工具名", async () => {
      mockMCPManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "结果" }],
      });

      const adapter = new InternalMCPManagerAdapter({
        mcpServers: {
          "test-service": { command: "node", args: ["server.js"] },
        },
      });

      await adapter.callTool("test-service__tool__with__underscores", {});

      expect(mockMCPManager.callTool).toHaveBeenCalledWith(
        "test-service",
        "tool__with__underscores",
        {}
      );
    });

    it("应该拒绝无效的工具名称格式", async () => {
      const adapter = new InternalMCPManagerAdapter({
        mcpServers: {
          "test-service": { command: "node", args: ["server.js"] },
        },
      });

      await expect(adapter.callTool("invalid-tool-name", {})).rejects.toThrow(
        "无效的工具名称格式: invalid-tool-name"
      );
    });

    it("应该传递工具调用结果", async () => {
      const mockResult: ToolCallResult = {
        content: [
          { type: "text", text: "行1" },
          { type: "text", text: "行2" },
        ],
        isError: false,
      };

      mockMCPManager.callTool.mockResolvedValue(mockResult);

      const adapter = new InternalMCPManagerAdapter({
        mcpServers: {
          "test-service": { command: "node", args: ["server.js"] },
        },
      });

      const result = await adapter.callTool("test-service__tool1", {});

      expect(result).toEqual(mockResult);
    });

    it("应该处理工具调用错误", async () => {
      mockMCPManager.callTool.mockRejectedValue(new Error("工具调用失败"));

      const adapter = new InternalMCPManagerAdapter({
        mcpServers: {
          "test-service": { command: "node", args: ["server.js"] },
        },
      });

      await expect(adapter.callTool("test-service__tool1", {})).rejects.toThrow(
        "工具调用失败"
      );
    });
  });

  describe("cleanup", () => {
    it("应该清理资源", async () => {
      const adapter = new InternalMCPManagerAdapter({
        mcpServers: {
          "test-service": { command: "node", args: ["server.js"] },
        },
      });

      await adapter.initialize();
      await adapter.cleanup();

      expect(mockMCPManager.disconnect).toHaveBeenCalled();
    });

    it("清理后应该清空工具列表", async () => {
      mockMCPManager.listTools.mockReturnValue([
        {
          serverName: "test-service",
          name: "tool1",
          description: "测试工具",
          inputSchema: { type: "object" },
        },
      ]);

      const adapter = new InternalMCPManagerAdapter({
        mcpServers: {
          "test-service": { command: "node", args: ["server.js"] },
        },
      });

      await adapter.initialize();
      expect(adapter.getAllTools()).toHaveLength(1);

      await adapter.cleanup();
      expect(adapter.getAllTools()).toHaveLength(0);
    });

    it("清理后应该可以重新初始化", async () => {
      const adapter = new InternalMCPManagerAdapter({
        mcpServers: {
          "test-service": { command: "node", args: ["server.js"] },
        },
      });

      await adapter.initialize();
      await adapter.cleanup();

      mockMCPManager.connect.mockClear();
      await adapter.initialize();

      expect(mockMCPManager.connect).toHaveBeenCalled();
    });
  });

  describe("事件监听", () => {
    it("应该在构造时设置事件监听器", () => {
      new InternalMCPManagerAdapter({
        mcpServers: {
          "test-service": { command: "node", args: ["server.js"] },
        },
      });

      expect(mockMCPManager.on).toHaveBeenCalledWith("connected", expect.any(Function));
      expect(mockMCPManager.on).toHaveBeenCalledWith("error", expect.any(Function));
    });

    it("connected 事件应该正确记录", () => {
      const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});

      new InternalMCPManagerAdapter({
        mcpServers: {
          "test-service": { command: "node", args: ["server.js"] },
        },
      });

      const onCalls = mockMCPManager.on.mock.calls;
      const connectedCallback = onCalls.find((call) => call[0] === "connected")?.[1];

      if (connectedCallback) {
        connectedCallback({ serverName: "test-service", tools: [] });
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("MCP 服务 test-service 已连接")
        );
      }

      consoleSpy.mockRestore();
    });

    it("error 事件应该正确记录", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      new InternalMCPManagerAdapter({
        mcpServers: {
          "test-service": { command: "node", args: ["server.js"] },
        },
      });

      const onCalls = mockMCPManager.on.mock.calls;
      const errorCallback = onCalls.find((call) => call[0] === "error")?.[1];

      if (errorCallback) {
        errorCallback({ serverName: "test-service", error: new Error("测试错误") });
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("MCP 服务 test-service 出错"),
          expect.any(Error)
        );
      }

      consoleSpy.mockRestore();
    });
  });

  describe("工具名称解析", () => {
    it("应该正确解析简单工具名", async () => {
      mockMCPManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "结果" }],
      });

      const adapter = new InternalMCPManagerAdapter({
        mcpServers: {
          "test-service": { command: "node", args: ["server.js"] },
        },
      });

      await adapter.callTool("test-service__tool1", {});

      expect(mockMCPManager.callTool).toHaveBeenCalledWith("test-service", "tool1", {});
    });

    it("应该正确解析包含 __ 的工具名", async () => {
      mockMCPManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "结果" }],
      });

      const adapter = new InternalMCPManagerAdapter({
        mcpServers: {
          "test-service": { command: "node", args: ["server.js"] },
        },
      });

      await adapter.callTool("test-service__my__complex__tool", {});

      expect(mockMCPManager.callTool).toHaveBeenCalledWith(
        "test-service",
        "my__complex__tool",
        {}
      );
    });

    it("应该拒绝没有 __ 的工具名", async () => {
      const adapter = new InternalMCPManagerAdapter({
        mcpServers: {
          "test-service": { command: "node", args: ["server.js"] },
        },
      });

      await expect(adapter.callTool("invalid", {})).rejects.toThrow(
        "无效的工具名称格式: invalid"
      );
    });
  });

  describe("边界情况", () => {
    it("应该处理空的 mcpServers 配置", async () => {
      const adapter = new InternalMCPManagerAdapter({
        mcpServers: {},
      });

      await adapter.initialize();

      expect(mockMCPManager.connect).toHaveBeenCalled();
      expect(adapter.getAllTools()).toHaveLength(0);
    });

    it("应该处理多个服务", async () => {
      mockMCPManager.listTools.mockReturnValue([
        { serverName: "service1", name: "tool1", description: "工具1", inputSchema: {} },
        { serverName: "service2", name: "tool2", description: "工具2", inputSchema: {} },
      ]);

      const adapter = new InternalMCPManagerAdapter({
        mcpServers: {
          service1: { command: "node", args: ["s1.js"] },
          service2: { url: "https://example.com/sse" },
        },
      });

      await adapter.initialize();

      const tools = adapter.getAllTools();
      expect(tools).toHaveLength(2);
      expect(tools[0].serviceName).toBe("service1");
      expect(tools[1].serviceName).toBe("service2");
    });
  });
});
