import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { IndependentXiaozhiConnectionManager } from "../manager.js";

// Mock dependencies
vi.mock("@root/Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    withTag: vi.fn().mockReturnValue({
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    }),
  },
}));

vi.mock("@root/configManager.js", () => ({
  ConfigManager: vi.fn().mockImplementation(() => ({
    getMcpEndpoints: vi.fn().mockReturnValue([]),
    addMcpEndpoint: vi.fn(),
    removeMcpEndpoint: vi.fn(),
  })),
}));

vi.mock("../connection.js", () => ({
  ProxyMCPServer: vi.fn().mockImplementation((endpoint: string) => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(false),
    on: vi.fn(),
    off: vi.fn(),
    destroy: vi.fn(),
    setServiceManager: vi.fn(),
    getTools: vi.fn().mockReturnValue([]),
    syncToolsFromServiceManager: vi.fn(),
  })),
}));

describe("IndependentXiaozhiConnectionManager 核心功能测试", () => {
  let manager: IndependentXiaozhiConnectionManager;
  let mockEventBus: any;
  let mockConfigManager: any;

  const testEndpoint = "ws://test-endpoint";
  const testTools: Tool[] = [
    {
      name: "test-tool",
      description: "测试工具",
      inputSchema: { type: "object" },
    },
  ];

  beforeEach(async () => {
    mockEventBus = {
      emitEvent: vi.fn(),
      onEvent: vi.fn(),
      offEvent: vi.fn(),
    };

    mockConfigManager = {
      getMcpEndpoints: vi.fn().mockReturnValue([testEndpoint]),
      addMcpEndpoint: vi.fn(),
      removeMcpEndpoint: vi.fn(),
    };

    vi.clearAllMocks();

    // 创建管理器实例
    manager = new IndependentXiaozhiConnectionManager(mockConfigManager);
    (manager as any).eventBus = mockEventBus;

    // 初始化管理器
    await manager.initialize([testEndpoint], testTools);
  });

  afterEach(async () => {
    if (manager) {
      await manager.disconnect();
      manager.removeAllListeners();
    }
  });

  describe("端点管理", () => {
    test("应该成功添加端点", async () => {
      await manager.addEndpoint(testEndpoint);

      const endpoints = manager.getEndpoints();
      expect(endpoints).toContain(testEndpoint);
      expect(mockConfigManager.addMcpEndpoint).toHaveBeenCalledWith(
        testEndpoint
      );
    });

    test("应该成功移除端点", async () => {
      // 先添加端点
      await manager.addEndpoint(testEndpoint);

      // 然后移除
      await manager.removeEndpoint(testEndpoint);

      expect(mockConfigManager.removeMcpEndpoint).toHaveBeenCalledWith(
        testEndpoint
      );
    });

    test("应该获取所有端点列表", async () => {
      await manager.addEndpoint(testEndpoint);

      const endpoints = manager.getEndpoints();
      expect(endpoints).toContain(testEndpoint);
    });

    test("应该检查是否有连接", async () => {
      // 初始状态应该没有连接
      expect(manager.isAnyConnected()).toBe(false);

      // 添加端点
      await manager.addEndpoint(testEndpoint);

      // 模拟连接
      const connections = (manager as any).connections;
      connections.get(testEndpoint).isConnected.mockReturnValue(true);

      expect(manager.isAnyConnected()).toBe(true);
    });

    test("应该获取连接状态", async () => {
      await manager.addEndpoint(testEndpoint);

      const status = manager.getConnectionStatus();
      expect(status).toHaveLength(1);
      expect(status[0].endpoint).toBe(testEndpoint);
    });
  });

  describe("连接管理", () => {
    test("应该成功连接所有端点", async () => {
      await manager.addEndpoint(testEndpoint);
      await manager.connect();

      const connections = (manager as any).connections;
      expect(connections.has(testEndpoint)).toBe(true);
    });

    test("应该成功断开所有端点", async () => {
      await manager.addEndpoint(testEndpoint);
      await manager.connect();
      await manager.disconnect();

      // 断开连接后应该没有活动连接
      expect(manager.isAnyConnected()).toBe(false);
    });

    test("应该断开指定端点", async () => {
      await manager.addEndpoint(testEndpoint);
      await manager.connect();

      await manager.disconnectEndpoint(testEndpoint);

      const connections = (manager as any).connections;
      expect(connections.has(testEndpoint)).toBe(false);
    });

    test("应该清除所有端点", async () => {
      await manager.addEndpoint(testEndpoint);
      await manager.addEndpoint("ws://test-endpoint-2");
      await manager.clearEndpoints();

      const endpoints = manager.getEndpoints();
      expect(endpoints).toHaveLength(0);
    });
  });

  describe("工具管理", () => {
    test("应该设置服务管理器", async () => {
      const mockServiceManager = {
        getAllTools: vi.fn().mockReturnValue(testTools),
        callTool: vi.fn(),
      };

      manager.setServiceManager(mockServiceManager);
      expect((manager as any).mcpServiceManager).toBe(mockServiceManager);
    });

    test("应该正确设置服务管理器", () => {
      const mockServiceManager = {
        getAllTools: vi.fn().mockReturnValue([]),
        callTool: vi.fn(),
      };

      manager.setServiceManager(mockServiceManager);
      expect((manager as any).mcpServiceManager).toBe(mockServiceManager);
    });
  });

  describe("事件管理", () => {
    test("应该添加和移除事件监听器", () => {
      const listener = vi.fn();

      manager.on("test-event", listener);
      manager.emit("test-event", { data: "test" });

      expect(listener).toHaveBeenCalledWith({ data: "test" });

      manager.off("test-event", listener);
      manager.emit("test-event", { data: "test2" });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    test("应该移除所有监听器", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      manager.on("event1", listener1);
      manager.on("event2", listener2);

      manager.removeAllListeners();

      manager.emit("event1", {});
      manager.emit("event2", {});

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });
  });

  describe("配置管理", () => {
    test("应该更新选项", () => {
      const newOptions = {
        maxReconnectAttempts: 10,
        reconnectInterval: 5000,
      };

      manager.updateOptions(newOptions);

      const config = manager.getCurrentConfig();
      expect(config.options.maxReconnectAttempts).toBe(10);
      expect(config.options.reconnectInterval).toBe(5000);
    });

    test("应该获取当前配置", () => {
      const config = manager.getCurrentConfig();
      expect(config).toBeDefined();
      expect(config.options).toBeDefined();
    });
  });

  describe("重连管理", () => {
    test("应该停止重连", async () => {
      await manager.addEndpoint(testEndpoint);

      manager.stopReconnect(testEndpoint);

      expect((manager as any).reconnectTimers.has(testEndpoint)).toBe(false);
    });

    test("应该停止所有重连", async () => {
      await manager.addEndpoint(testEndpoint);
      await manager.addEndpoint("ws://test-endpoint-2");

      manager.stopAllReconnects();

      expect((manager as any).reconnectTimers.size).toBe(0);
    });

    test("应该获取重连统计", async () => {
      await manager.addEndpoint(testEndpoint);

      const stats = manager.getReconnectStats();
      expect(stats).toBeDefined();
      expect(typeof stats).toBe("object");
    });
  });

  describe("清理工作", () => {
    test("应该执行清理", async () => {
      await manager.addEndpoint(testEndpoint);
      await manager.connect();

      await manager.cleanup();

      expect((manager as any).connections.size).toBe(0);
      expect((manager as any).reconnectTimers.size).toBe(0);
    });
  });
});
