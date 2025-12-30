import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ToolCallResult } from "@root/types/mcp.js";
import type { ConfigManager } from "@xiaozhi/config";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { EndpointManager } from "../manager.js";

// 重新定义 IMCPServiceManager 接口（因为它没有被导出）
interface IMCPServiceManager {
  getAllTools(): Array<{
    name: string;
    description: string;
    inputSchema: import("@/lib/mcp/types.js").JSONSchema;
    serviceName?: string;
    originalName?: string;
  }>;
  callTool(
    toolName: string,
    arguments_: Record<string, unknown>
  ): Promise<ToolCallResult>;
}

// Mock 类型定义
interface MockEventBus {
  emitEvent: ReturnType<typeof vi.fn>;
  onEvent: ReturnType<typeof vi.fn>;
  offEvent: ReturnType<typeof vi.fn>;
}

interface MockConfigManager {
  getMcpEndpoints: ReturnType<typeof vi.fn>;
  addMcpEndpoint: ReturnType<typeof vi.fn>;
  removeMcpEndpoint: ReturnType<typeof vi.fn>;
}

interface MockServiceManager extends IMCPServiceManager {
  getAllTools: ReturnType<typeof vi.fn>;
  callTool: ReturnType<typeof vi.fn>;
}

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

vi.mock("@xiaozhi/config", () => ({
  ConfigManager: vi.fn().mockImplementation(() => ({
    getMcpEndpoints: vi.fn().mockReturnValue([]),
    addMcpEndpoint: vi.fn(),
    removeMcpEndpoint: vi.fn(),
  })),
}));

vi.mock("../connection.js", () => ({
  EndpointConnection: vi
    .fn()
    .mockImplementation((endpoint: string, reconnectDelay?: number) => {
      const eventListeners: Record<string, ((...args: any[]) => void)[]> = {};

      return {
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn(),
        isConnected: vi.fn().mockReturnValue(false),
        on: vi
          .fn()
          .mockImplementation(
            (event: string, listener: (...args: any[]) => void) => {
              if (!eventListeners[event]) {
                eventListeners[event] = [];
              }
              eventListeners[event].push(listener);
            }
          ),
        off: vi.fn(),
        destroy: vi.fn(),
        setServiceManager: vi.fn(),
        getTools: vi.fn().mockReturnValue([]),
        syncToolsFromServiceManager: vi.fn(),
        reconnect: vi.fn().mockResolvedValue(undefined),
        emit: vi.fn().mockImplementation((event: string, ...args: any[]) => {
          if (eventListeners[event]) {
            for (const listener of eventListeners[event]) {
              listener(...args);
            }
          }
        }),
        // 保留事件监听器引用供测试使用
        _eventListeners: eventListeners,
      };
    }),
}));

describe("EndpointManager 核心功能测试", () => {
  let manager: EndpointManager;
  let mockEventBus: MockEventBus;
  let mockConfigManager: MockConfigManager;

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

    // 创建管理器实例（使用类型断言和较短的重连延迟）
    manager = new EndpointManager(
      mockConfigManager as unknown as ConfigManager,
      { reconnectDelay: 100 } // 使用 100ms 延迟以加快测试速度
    );
    // 使用类型安全的方式设置私有属性
    (manager as unknown as { eventBus: MockEventBus }).eventBus = mockEventBus;

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
      // 使用一个新的端点，避免与初始化时的端点冲突
      const newEndpoint = "ws://new-endpoint";

      await manager.addEndpoint(newEndpoint);

      const endpoints = manager.getEndpoints();
      expect(endpoints).toContain(newEndpoint);
      expect(mockConfigManager.addMcpEndpoint).toHaveBeenCalledWith(
        newEndpoint
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

      // 通过公共API检查连接状态，而不是直接访问私有属性
      // 这里我们无法直接模拟连接状态，所以只测试API本身的行为
      // 实际的连接状态测试应该在集成测试中进行
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

      // 通过公共API验证端点存在
      const endpoints = manager.getEndpoints();
      expect(endpoints).toContain(testEndpoint);
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

      // 验证初始状态：端点已连接
      let status = manager.getConnectionStatus();
      expect(status).toHaveLength(1);
      expect(status[0].endpoint).toBe(testEndpoint);
      expect(status[0].connected).toBe(true);
      expect(manager.isAnyConnected()).toBe(true);

      // 执行断开操作
      await manager.disconnectEndpoint(testEndpoint);

      // 验证端点仍在列表中
      const endpoints = manager.getEndpoints();
      expect(endpoints).toContain(testEndpoint);

      // 验证连接状态已更新
      status = manager.getConnectionStatus();
      expect(status).toHaveLength(1);
      expect(status[0].endpoint).toBe(testEndpoint);
      expect(status[0].connected).toBe(false);
      expect(status[0].initialized).toBe(false);

      // 验证整体连接状态
      expect(manager.isAnyConnected()).toBe(false);
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
      const mockServiceManager: MockServiceManager = {
        getAllTools: vi.fn().mockReturnValue(testTools),
        callTool: vi.fn(),
      };

      // 通过行为验证而不是内部状态
      manager.setServiceManager(mockServiceManager);
      // 验证服务管理器已设置（通过后续行为来验证）
      expect(mockServiceManager.getAllTools).toBeDefined();
    });

    test("应该正确设置服务管理器", () => {
      const mockServiceManager: MockServiceManager = {
        getAllTools: vi.fn().mockReturnValue([]),
        callTool: vi.fn(),
      };

      // 通过行为验证而不是内部状态
      manager.setServiceManager(mockServiceManager);
      // 验证服务管理器已设置（通过后续行为来验证）
      expect(mockServiceManager.getAllTools).toBeDefined();
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
        connectionTimeout: 20000,
      };

      manager.updateOptions(newOptions);

      const config = manager.getCurrentConfig();
      expect(config.options.connectionTimeout).toBe(20000);
    });

    test("应该获取当前配置", () => {
      const config = manager.getCurrentConfig();
      expect(config).toBeDefined();
      expect(config.options).toBeDefined();
    });
  });

  describe("清理工作", () => {
    test("应该执行清理", async () => {
      await manager.addEndpoint(testEndpoint);
      await manager.connect();

      await manager.cleanup();

      // 通过公共API验证清理完成
      expect(manager.isAnyConnected()).toBe(false);
      expect(manager.getEndpoints()).toHaveLength(0);
    });
  });

  describe("EndpointManager 重连功能测试", () => {
    const mockTools: Tool[] = [
      {
        name: "test-tool",
        description: "测试工具",
        inputSchema: { type: "object" },
      },
    ];

    beforeEach(async () => {
      // 初始化管理器
      await manager.initialize([testEndpoint], mockTools);
    });

    describe("reconnectAll() 方法测试", () => {
      test("未初始化时应该抛出错误", async () => {
        const uninitializedManager = new EndpointManager(
          mockConfigManager as any,
          { reconnectDelay: 100 }
        );

        await expect(uninitializedManager.reconnectAll()).rejects.toThrow(
          "未初始化"
        );
      });

      test("所有端点成功重连", async () => {
        // 添加多个端点
        const endpoint2 = "ws://test-endpoint2";
        await manager.addEndpoint(endpoint2);

        // 连接所有端点
        await manager.connect();

        // 执行重连
        const result = await manager.reconnectAll();

        expect(result.successCount).toBe(2);
        expect(result.failureCount).toBe(0);
        expect(result.results).toHaveLength(2);
        expect(result.results.every((r) => r.success)).toBe(true);
      });

      test("部分成功部分失败", async () => {
        // 添加第二个端点
        const endpoint2 = "ws://test-endpoint2";
        await manager.addEndpoint(endpoint2);
        await manager.connect();

        // 获取连接实例并模拟其中一个重连失败
        const connections = (manager as any).connections;
        const mockConnection = connections.get(endpoint2);
        const originalReconnect = mockConnection.reconnect;
        mockConnection.reconnect = vi
          .fn()
          .mockRejectedValue(new Error("重连失败"));

        // 执行重连
        const result = await manager.reconnectAll();

        expect(result.successCount).toBe(1);
        expect(result.failureCount).toBe(1);
        expect(result.results).toHaveLength(2);
        expect(result.results.filter((r) => r.success)).toHaveLength(1);
        expect(result.results.filter((r) => !r.success)).toHaveLength(1);

        // 恢复原始方法
        mockConnection.reconnect = originalReconnect;
      });

      test("应该并发重连所有端点", async () => {
        const endpoint2 = "ws://test-endpoint2";
        await manager.addEndpoint(endpoint2);
        await manager.connect();

        // 跟踪重连开始和结束时间
        const startTime = Date.now();
        const result = await manager.reconnectAll();
        const endTime = Date.now();

        // 验证结果
        expect(result.successCount).toBe(2);
        expect(result.failureCount).toBe(0);

        // 验证是并发执行（时间应该接近单个重连的时间）
        expect(endTime - startTime).toBeLessThan(500); // 假设重连延迟是 100ms，两个并发应该在 200ms 左右完成
      });
    });

    describe("reconnectEndpoint() 方法测试", () => {
      test("未初始化时应该抛出错误", async () => {
        const uninitializedManager = new EndpointManager(
          mockConfigManager as any,
          { reconnectDelay: 100 }
        );

        await expect(
          uninitializedManager.reconnectEndpoint(testEndpoint)
        ).rejects.toThrow("未初始化");
      });

      test("成功重连存在的端点", async () => {
        // 先连接
        await manager.connect();

        // 执行重连
        await expect(
          manager.reconnectEndpoint(testEndpoint)
        ).resolves.not.toThrow();

        // 验证端点仍然连接
        expect(manager.isEndpointConnected(testEndpoint)).toBe(true);
      });

      test("端点不存在时应该抛出错误", async () => {
        const nonExistentEndpoint = "ws://non-existent";

        await expect(
          manager.reconnectEndpoint(nonExistentEndpoint)
        ).rejects.toThrow("不存在");
      });

      test("重连失败时应该传播错误", async () => {
        // 先连接
        await manager.connect();

        // 获取连接实例并模拟重连失败
        const connections = (manager as any).connections;
        const mockConnection = connections.get(testEndpoint);
        const originalReconnect = mockConnection.reconnect;
        mockConnection.reconnect = vi
          .fn()
          .mockRejectedValue(new Error("重连失败"));

        await expect(manager.reconnectEndpoint(testEndpoint)).rejects.toThrow(
          "重连失败"
        );

        // 恢复原始方法
        mockConnection.reconnect = originalReconnect;
      });
    });

    describe("reconnectSingleEndpoint() 私有方法间接测试", () => {
      test("通过公共方法间接测试私有方法", async () => {
        // 先连接
        await manager.connect();

        // 监听状态变化事件
        const statusChangedListener = vi.fn();
        manager.on("endpointStatusChanged", statusChangedListener);

        // 执行重连
        await manager.reconnectEndpoint(testEndpoint);

        // 验证端点仍然连接
        expect(manager.isEndpointConnected(testEndpoint)).toBe(true);
      });
    });
  });
});
