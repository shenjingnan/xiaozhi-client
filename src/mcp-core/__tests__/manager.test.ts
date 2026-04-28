import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MCPManager } from "../manager.js";
import { MCPTransportType } from "../types.js";
import type { MCPServiceConfig } from "../types.js";

// Mock MCPConnection
vi.mock("../connection.js", () => {
  const mockIsConnected = vi.fn();
  const mockConnect = vi.fn();
  const mockDisconnect = vi.fn();
  const mockCallTool = vi.fn();
  const mockGetTools = vi.fn(() => []);
  const mockGetStatus = vi.fn(() => ({ connected: false, toolCount: 0 }));

  class MockMCPConnection {
    isConnected = mockIsConnected;
    connect = mockConnect;
    disconnect = mockDisconnect;
    callTool = mockCallTool;
    getTools = mockGetTools;
    getStatus = mockGetStatus;

    constructor(
      _name: string,
      _config: MCPServiceConfig,
      callbacks?: {
        onConnected?: (data: unknown) => void;
        onDisconnected?: (data: unknown) => void;
        onConnectionFailed?: (data: unknown) => void;
      }
    ) {
      // 存储回调以便测试中使用
      (this as unknown as Record<string, unknown>)._callbacks = callbacks;
    }
  }

  return {
    MCPConnection: MockMCPConnection,
    __mocks: {
      mockIsConnected,
      mockConnect,
      mockDisconnect,
      mockCallTool,
      mockGetTools,
      mockGetStatus,
    },
  };
});

// 获取 mock 函数引用
let mocks: {
  mockIsConnected: ReturnType<typeof vi.fn>;
  mockConnect: ReturnType<typeof vi.fn>;
  mockDisconnect: ReturnType<typeof vi.fn>;
  mockCallTool: ReturnType<typeof vi.fn>;
  mockGetTools: ReturnType<typeof vi.fn>;
  mockGetStatus: ReturnType<typeof vi.fn>;
};

describe("MCPManager", () => {
  let manager: MCPManager;

  beforeEach(async () => {
    const mod = await import("../connection.js");
    mocks = (mod as unknown as { __mocks: typeof mocks }).__mocks;
    manager = new MCPManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // =========================
  // addServer / removeServer
  // =========================

  describe("服务配置管理", () => {
    it("应该能够添加服务配置", () => {
      manager.addServer("test-service", {
        type: MCPTransportType.STDIO,
        command: "node",
        args: ["server.js"],
      });

      expect(manager.getServerNames()).toContain("test-service");
    });

    it("添加重复名称的服务应该抛出错误", () => {
      manager.addServer("dup", {
        type: MCPTransportType.STDIO,
        command: "node",
      });

      expect(() =>
        manager.addServer("dup", {
          type: MCPTransportType.STDIO,
          command: "node",
        })
      ).toThrow("服务 dup 已存在");
    });

    it("应该能够移除服务配置", () => {
      manager.addServer("removable", {
        type: MCPTransportType.STDIO,
        command: "node",
      });
      const result = manager.removeServer("removable");

      expect(result).toBe(true);
      expect(manager.getServerNames()).not.toContain("removable");
    });

    it("移除不存在的服务应该返回 false", () => {
      const result = manager.removeServer("nonexistent");

      expect(result).toBe(false);
    });

    it("应该将字符串类型的 http 标准化为枚举值", () => {
      manager.addServer("http-svc", {
        type: "http" as unknown as MCPTransportType,
        url: "http://localhost:3000/mcp",
      });

      expect(manager.getServerNames()).toContain("http-svc");
    });

    it("应该将字符串类型的 sse 标准化为枚举值", () => {
      manager.addServer("sse-svc", {
        type: "sse" as unknown as MCPTransportType,
        url: "http://localhost:3000/sse",
      });

      expect(manager.getServerNames()).toContain("sse-svc");
    });
  });

  // =========================
  // connect / disconnect
  // =========================

  describe("连接管理", () => {
    it("连接时应该发射 connect 事件", async () => {
      mocks.mockConnect.mockResolvedValue(undefined);

      manager.addServer("svc1", {
        type: MCPTransportType.STDIO,
        command: "node",
      });

      const emitSpy = vi.spyOn(manager, "emit");
      await manager.connect();

      expect(emitSpy).toHaveBeenCalledWith("connect");
    });

    it("连接成功后应该建立连接实例", async () => {
      mocks.mockConnect.mockResolvedValue(undefined);

      manager.addServer("svc1", {
        type: MCPTransportType.STDIO,
        command: "node",
      });
      await manager.connect();

      expect(mocks.mockConnect).toHaveBeenCalledOnce();
    });

    it("断开连接时应该发射 disconnect 事件", async () => {
      mocks.mockDisconnect.mockResolvedValue(undefined);

      manager.addServer("svc1", {
        type: MCPTransportType.STDIO,
        command: "node",
      });
      await manager.connect();

      const emitSpy = vi.spyOn(manager, "emit");
      await manager.disconnect();

      expect(emitSpy).toHaveBeenCalledWith("disconnect");
    });

    it("断开连接后应该清空所有连接", async () => {
      mocks.mockDisconnect.mockResolvedValue(undefined);

      manager.addServer("svc1", {
        type: MCPTransportType.STDIO,
        command: "node",
      });
      await manager.connect();
      await manager.disconnect();

      expect(manager.getConnectedServerNames()).toHaveLength(0);
    });

    it("无服务时 connect 和 disconnect 应该正常完成", async () => {
      await expect(manager.connect()).resolves.toBeUndefined();
      await expect(manager.disconnect()).resolves.toBeUndefined();
    });
  });

  // =========================
  // callTool
  // =========================

  describe("工具调用", () => {
    it("调用不存在服务的工具应该抛出错误", async () => {
      await expect(manager.callTool("nonexistent", "tool", {})).rejects.toThrow(
        "服务 nonexistent 不存在"
      );
    });

    it("调用未连接服务的工具应该抛出错误", async () => {
      mocks.mockConnect.mockResolvedValue(undefined);
      mocks.mockIsConnected.mockReturnValue(false);

      manager.addServer("svc1", {
        type: MCPTransportType.STDIO,
        command: "node",
      });
      await manager.connect();

      await expect(manager.callTool("svc1", "some-tool", {})).rejects.toThrow(
        "服务 svc1 未连接"
      );
    });

    it("调用已连接服务的工具应该返回结果", async () => {
      mocks.mockConnect.mockResolvedValue(undefined);
      mocks.mockIsConnected.mockReturnValue(true);
      const mockResult = { content: [{ type: "text", text: "result" }] };
      mocks.mockCallTool.mockResolvedValue(mockResult);

      manager.addServer("svc1", {
        type: MCPTransportType.STDIO,
        command: "node",
      });
      await manager.connect();

      const result = await manager.callTool("svc1", "some-tool", {
        key: "value",
      });

      expect(result).toEqual(mockResult);
      expect(mocks.mockCallTool).toHaveBeenCalledWith("some-tool", {
        key: "value",
      });
    });
  });

  // =========================
  // listTools
  // =========================

  describe("工具列表", () => {
    it("无连接时应返回空列表", () => {
      const tools = manager.listTools();

      expect(tools).toEqual([]);
    });

    it("已连接服务有工具时应返回工具列表", async () => {
      mocks.mockConnect.mockResolvedValue(undefined);
      mocks.mockIsConnected.mockReturnValue(true);
      mocks.mockGetTools.mockReturnValue([
        { name: "tool-a", description: "工具A", inputSchema: {} },
        {
          name: "tool-b",
          description: "工具B",
          inputSchema: { type: "object" },
        },
      ]);

      manager.addServer("svc1", {
        type: MCPTransportType.STDIO,
        command: "node",
      });
      await manager.connect();

      const tools = manager.listTools();

      expect(tools).toHaveLength(2);
      expect(tools[0]).toEqual({
        name: "tool-a",
        serverName: "svc1",
        description: "工具A",
        inputSchema: {},
      });
    });

    it("未连接的服务不应出现在工具列表中", async () => {
      mocks.mockConnect.mockResolvedValue(undefined);
      mocks.mockIsConnected.mockReturnValue(false);

      manager.addServer("svc1", {
        type: MCPTransportType.STDIO,
        command: "node",
      });
      await manager.connect();

      const tools = manager.listTools();

      expect(tools).toEqual([]);
    });
  });

  // =========================
  // getServerStatus / getAllServerStatus
  // =========================

  describe("状态查询", () => {
    it("获取不存在的服务状态应返回 null", () => {
      const status = manager.getServerStatus("nonexistent");

      expect(status).toBeNull();
    });

    it("获取已连接服务的状态应返回正确信息", async () => {
      mocks.mockConnect.mockResolvedValue(undefined);
      mocks.mockIsConnected.mockReturnValue(true);
      mocks.mockGetStatus.mockReturnValue({ connected: true, toolCount: 5 });

      manager.addServer("svc1", {
        type: MCPTransportType.STDIO,
        command: "node",
      });
      await manager.connect();

      const status = manager.getServerStatus("svc1");

      expect(status).toEqual({ connected: true, toolCount: 5 });
    });

    it("获取所有服务状态应包含所有已连接服务", async () => {
      mocks.mockConnect.mockResolvedValue(undefined);
      mocks.mockIsConnected.mockReturnValue(true);
      mocks.mockGetStatus.mockReturnValue({ connected: true, toolCount: 3 });

      manager.addServer("svc1", {
        type: MCPTransportType.STDIO,
        command: "node",
      });
      manager.addServer("svc2", {
        type: MCPTransportType.HTTP,
        url: "http://localhost",
      });
      await manager.connect();

      const statuses = manager.getAllServerStatus();

      expect(Object.keys(statuses)).toContain("svc1");
      expect(Object.keys(statuses)).toContain("svc2");
      expect(statuses.svc1).toEqual({ connected: true, toolCount: 3 });
    });

    it("无连接服务时 getAllServerStatus 应返回空对象", () => {
      const statuses = manager.getAllServerStatus();

      expect(statuses).toEqual({});
    });
  });

  // =========================
  // isConnected
  // =========================

  describe("连接检查", () => {
    it("不存在的服务应返回 false", () => {
      expect(manager.isConnected("nonexistent")).toBe(false);
    });

    it("已连接的服务应返回 true", async () => {
      mocks.mockConnect.mockResolvedValue(undefined);
      mocks.mockIsConnected.mockReturnValue(true);

      manager.addServer("svc1", {
        type: MCPTransportType.STDIO,
        command: "node",
      });
      await manager.connect();

      expect(manager.isConnected("svc1")).toBe(true);
    });

    it("未连接的服务应返回 false", async () => {
      mocks.mockConnect.mockResolvedValue(undefined);
      mocks.mockIsConnected.mockReturnValue(false);

      manager.addServer("svc1", {
        type: MCPTransportType.STDIO,
        command: "node",
      });
      await manager.connect();

      expect(manager.isConnected("svc1")).toBe(false);
    });
  });

  // =========================
  // getServerNames / getConnectedServerNames
  // =========================

  describe("服务列表查询", () => {
    it("getServerNames 应返回所有已配置的服务名", () => {
      manager.addServer("svc-a", {
        type: MCPTransportType.STDIO,
        command: "node",
      });
      manager.addServer("svc-b", {
        type: MCPTransportType.HTTP,
        url: "http://x",
      });

      const names = manager.getServerNames();

      expect(names).toContain("svc-a");
      expect(names).toContain("svc-b");
      expect(names).toHaveLength(2);
    });

    it("无配置服务时 getServerNames 应返回空数组", () => {
      expect(manager.getServerNames()).toEqual([]);
    });

    it("getConnectedServerNames 应只返回已连接的服务", async () => {
      mocks.mockConnect.mockResolvedValue(undefined);
      mocks.mockIsConnected.mockReturnValue(true);

      manager.addServer("svc-a", {
        type: MCPTransportType.STDIO,
        command: "node",
      });
      manager.addServer("svc-b", {
        type: MCPTransportType.HTTP,
        url: "http://x",
      });
      await manager.connect();

      const connected = manager.getConnectedServerNames();

      // 两个服务都已连接，应都出现在列表中
      expect(connected).toContain("svc-a");
      expect(connected).toContain("svc-b");
      expect(connected).toHaveLength(2);
    });

    it("所有服务未连接时 getConnectedServerNames 应返回空数组", async () => {
      mocks.mockConnect.mockResolvedValue(undefined);
      mocks.mockIsConnected.mockReturnValue(false);

      manager.addServer("svc-a", {
        type: MCPTransportType.STDIO,
        command: "node",
      });
      await manager.connect();

      const connected = manager.getConnectedServerNames();

      expect(connected).toEqual([]);
    });
  });
});
