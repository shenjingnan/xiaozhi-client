/**
 * MCPManager 单元测试
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MCPTransportType } from "../types.js";
import type { MCPServerTransport, MCPServiceConfig } from "../types.js";
import { MCPManager } from "../manager.js";

// Mock 接口定义
interface MockClient {
  connect: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  listTools: ReturnType<typeof vi.fn>;
  callTool: ReturnType<typeof vi.fn>;
  ping: ReturnType<typeof vi.fn>;
}

// Mock 依赖
vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: vi.fn(),
}));

// Mock transport-factory
vi.mock("../transport-factory.js", () => {
  const mockTransportFactory = {
    validateConfig: vi.fn(),
    create: vi.fn(),
    getSupportedTypes: vi.fn().mockReturnValue([
      "stdio",
      "sse",
      "http",
    ]),
  };

  return {
    TransportFactory: mockTransportFactory,
    __mockTransportFactory: mockTransportFactory,
  };
});

// 获取 mock 函数
let mockTransportFactory: {
  validateConfig: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  getSupportedTypes: ReturnType<typeof vi.fn>;
};

describe("MCPManager", () => {
  let mockClient: MockClient;
  let mockTransport: MCPServerTransport;
  let manager: MCPManager;
  let config: MCPServiceConfig;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock Client
    mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      listTools: vi.fn().mockResolvedValue({ tools: [] }),
      callTool: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "Success" }],
      }),
      ping: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(Client).mockImplementation(() => mockClient as unknown as Client);

    // Mock Transport
    mockTransport = {
      async start() {
        return undefined;
      },
      async close() {
        return undefined;
      },
    } as unknown as MCPServerTransport;

    // 获取 mock TransportFactory
    const module = await import("../transport-factory.js");
    mockTransportFactory = (module as unknown as {
      __mockTransportFactory: {
        validateConfig: ReturnType<typeof vi.fn>;
        create: ReturnType<typeof vi.fn>;
        getSupportedTypes: ReturnType<typeof vi.fn>;
      };
    }).__mockTransportFactory;

    mockTransportFactory.validateConfig.mockReset();
    mockTransportFactory.create.mockReset();
    mockTransportFactory.create.mockReturnValue(mockTransport);
    mockTransportFactory.getSupportedTypes.mockReset();
    mockTransportFactory.getSupportedTypes.mockReturnValue([
      MCPTransportType.STDIO,
      MCPTransportType.SSE,
      MCPTransportType.HTTP,
    ]);

    // Test configuration
    config = {
      type: MCPTransportType.STDIO,
      command: "node",
      args: ["test-server.js"],
    };

    manager = new MCPManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe("addServer", () => {
    it("应该成功添加服务器", () => {
      manager.addServer("test-service", config);
      expect(manager.getServerNames()).toContain("test-service");
    });

    it("添加重复的服务器应该抛出错误", () => {
      manager.addServer("test-service", config);
      expect(() => manager.addServer("test-service", config)).toThrow(
        "服务 test-service 已存在"
      );
    });

    it("应该支持添加多个服务器", () => {
      manager.addServer("service1", config);
      manager.addServer("service2", config);
      expect(manager.getServerNames()).toEqual(["service1", "service2"]);
    });
  });

  describe("removeServer", () => {
    it("应该移除已连接的服务器并断开连接", async () => {
      manager.addServer("test-service", config);

      // 连接服务
      await manager.connect();
      expect(manager.getConnectedServerNames()).toContain("test-service");

      // 移除服务
      const result = await manager.removeServer("test-service");

      expect(result).toBe(true);
      expect(manager.getServerNames()).not.toContain("test-service");
      expect(manager.getConnectedServerNames()).not.toContain("test-service");
      expect(mockClient.close).toHaveBeenCalled();
    });

    it("移除未连接的服务器应该只删除配置", async () => {
      manager.addServer("test-service", config);

      // 不连接，直接移除
      const result = await manager.removeServer("test-service");

      expect(result).toBe(true);
      expect(manager.getServerNames()).not.toContain("test-service");
      expect(mockClient.close).not.toHaveBeenCalled();
    });

    it("移除不存在的服务器应该返回 false", async () => {
      const result = await manager.removeServer("non-existent");
      expect(result).toBe(false);
    });

    it("移除服务器应该清理心跳定时器", async () => {
      const sseConfig: MCPServiceConfig = {
        type: MCPTransportType.SSE,
        url: "https://test.example.com/sse",
        heartbeat: {
          enabled: true,
          interval: 5000,
        },
      };

      manager.addServer("sse-service", sseConfig);
      await manager.connect();

      // 快进时间，触发心跳
      vi.advanceTimersByTime(5000);
      expect(mockClient.ping).toHaveBeenCalledTimes(1);

      // 移除服务
      await manager.removeServer("sse-service");

      // 重置 mock
      mockClient.ping.mockClear();

      // 再次快进时间，心跳应该不再执行
      vi.advanceTimersByTime(5000);
      expect(mockClient.ping).not.toHaveBeenCalled();
    });

    it("应该能够移除多个服务器", async () => {
      manager.addServer("service1", config);
      manager.addServer("service2", config);
      manager.addServer("service3", config);

      await manager.connect();

      // 移除 service2
      await manager.removeServer("service2");

      expect(manager.getServerNames()).toEqual(["service1", "service3"]);
      expect(manager.getConnectedServerNames()).toEqual(["service1", "service3"]);
    });
  });

  describe("connect", () => {
    it("应该成功连接所有服务器", async () => {
      manager.addServer("service1", config);
      manager.addServer("service2", config);

      await manager.connect();

      expect(manager.getConnectedServerNames()).toEqual(["service1", "service2"]);
    });

    it("应该能够获取服务器状态", async () => {
      manager.addServer("test-service", config);

      const statusBefore = manager.getServerStatus("test-service");
      expect(statusBefore).toBeNull();

      await manager.connect();

      const statusAfter = manager.getServerStatus("test-service");
      expect(statusAfter).toEqual({
        connected: true,
        toolCount: 0,
      });
    });

    it("应该能够列出所有工具", async () => {
      const mockTools: Tool[] = [
        { name: "tool1", description: "测试工具 1", inputSchema: {} },
        { name: "tool2", description: "测试工具 2", inputSchema: {} },
      ];

      mockClient.listTools.mockResolvedValue({ tools: mockTools });

      manager.addServer("test-service", config);
      await manager.connect();

      const tools = manager.listTools();

      expect(tools).toHaveLength(2);
      expect(tools[0]).toEqual({
        name: "tool1",
        serverName: "test-service",
        description: "测试工具 1",
        inputSchema: {},
      });
    });
  });

  describe("disconnect", () => {
    it("应该断开所有服务器连接", async () => {
      manager.addServer("service1", config);
      manager.addServer("service2", config);

      await manager.connect();
      expect(manager.getConnectedServerNames()).toHaveLength(2);

      await manager.disconnect();
      expect(manager.getConnectedServerNames()).toHaveLength(0);
    });
  });

  describe("callTool", () => {
    it("应该成功调用工具", async () => {
      const mockTools: Tool[] = [
        { name: "test-tool", description: "测试工具", inputSchema: {} },
      ];

      mockClient.listTools.mockResolvedValue({ tools: mockTools });

      manager.addServer("test-service", config);
      await manager.connect();

      await manager.callTool("test-service", "test-tool", { param: "value" });

      expect(mockClient.callTool).toHaveBeenCalledWith({
        name: "test-tool",
        arguments: { param: "value" },
      });
    });

    it("服务不存在时应该抛出错误", async () => {
      await expect(
        manager.callTool("non-existent", "tool", {})
      ).rejects.toThrow("服务 non-existent 不存在");
    });

    it("服务未连接时应该抛出错误", async () => {
      manager.addServer("test-service", config);
      await manager.connect();
      await manager.disconnect();

      await expect(
        manager.callTool("test-service", "tool", {})
      ).rejects.toThrow("服务 test-service 不存在");
    });
  });

  describe("资源管理", () => {
    it("移除服务器后不应该保留连接引用", async () => {
      manager.addServer("test-service", config);
      await manager.connect();

      // 验证连接存在
      expect(manager.isConnected("test-service")).toBe(true);

      // 移除服务
      await manager.removeServer("test-service");

      // 验证连接不存在
      expect(manager.isConnected("test-service")).toBe(false);
    });

    it("断开连接后应该能够重新连接", async () => {
      manager.addServer("test-service", config);

      // 第一次连接
      await manager.connect();
      expect(manager.isConnected("test-service")).toBe(true);

      // 断开连接
      await manager.disconnect();
      expect(manager.isConnected("test-service")).toBe(false);

      // 重置 mock
      mockClient.connect.mockClear();
      mockClient.listTools.mockClear();

      // 重新连接
      await manager.connect();
      expect(manager.isConnected("test-service")).toBe(true);
    });
  });

  describe("事件处理", () => {
    it("应该在连接成功时发射事件", async () => {
      const onConnectedSpy = vi.fn();
      manager.on("connected", onConnectedSpy);

      manager.addServer("test-service", config);
      await manager.connect();

      expect(onConnectedSpy).toHaveBeenCalledWith({
        serverName: "test-service",
        tools: [],
      });
    });

    it("应该在断开连接时发射事件", async () => {
      const onDisconnectedSpy = vi.fn();
      manager.on("disconnected", onDisconnectedSpy);

      manager.addServer("test-service", config);
      await manager.connect();
      await manager.disconnect();

      expect(onDisconnectedSpy).toHaveBeenCalled();
    });
  });

  describe("getAllServerStatus", () => {
    it("应该返回所有服务器的状态", async () => {
      manager.addServer("service1", config);
      manager.addServer("service2", config);

      await manager.connect();

      const statuses = manager.getAllServerStatus();

      expect(statuses).toEqual({
        service1: {
          connected: true,
          toolCount: 0,
        },
        service2: {
          connected: true,
          toolCount: 0,
        },
      });
    });
  });

  describe("getConnectedServerNames", () => {
    it("应该返回已连接的服务器名称列表", async () => {
      manager.addServer("service1", config);
      manager.addServer("service2", config);

      expect(manager.getConnectedServerNames()).toEqual([]);

      await manager.connect();

      expect(manager.getConnectedServerNames()).toEqual([
        "service1",
        "service2",
      ]);
    });
  });
});
