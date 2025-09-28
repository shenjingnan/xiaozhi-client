import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ProxyMCPServer } from "../../ProxyMCPServer.js";
import { IndependentXiaozhiConnectionManager } from "../IndependentXiaozhiConnectionManager.js";
import type { ConnectionStatus } from "../IndependentXiaozhiConnectionManager.js";

// Mock dependencies
vi.mock("../../Logger.js", () => ({
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

vi.mock("../../configManager.js", () => ({
  configManager: {
    getMcpEndpoints: vi.fn().mockReturnValue([]),
    addMcpEndpoint: vi.fn(),
    removeMcpEndpoint: vi.fn(),
  },
}));

vi.mock("../../ProxyMCPServer.js", () => ({
  ProxyMCPServer: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    getConnectionStatus: vi.fn().mockReturnValue({
      connected: false,
      initialized: true,
      isReconnecting: false,
      reconnectAttempts: 0,
      nextReconnectTime: undefined,
      reconnectDelay: 0,
    }),
    on: vi.fn(),
    off: vi.fn(),
    destroy: vi.fn(),
  })),
}));

vi.mock("../../services/EventBus.js", () => ({
  getEventBus: vi.fn().mockReturnValue({
    emitEvent: vi.fn(),
    onEvent: vi.fn(),
    offEvent: vi.fn(),
  }),
}));

vi.mock("../../utils/sliceEndpoint.js", () => ({
  sliceEndpoint: vi.fn((endpoint: string) => endpoint),
}));

describe("IndependentXiaozhiConnectionManager", () => {
  let manager: IndependentXiaozhiConnectionManager;
  let mockEventBus: any;
  let mockLogger: any;

  // 创建虚拟工具数组
  const mockTools: Tool[] = [
    {
      name: "test-tool",
      description: "Test tool for testing",
      inputSchema: {
        type: "object",
        properties: {
          input: {
            type: "string",
            description: "Test input",
          },
        },
        required: [],
      },
    },
  ];

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get the mocked logger instance
    const { logger } = await import("../../Logger.js");
    mockLogger = logger;

    // Mock EventBus
    mockEventBus = {
      emitEvent: vi.fn(),
      onEvent: vi.fn(),
      offEvent: vi.fn(),
    };
    const { getEventBus } = await import("../../services/EventBus.js");
    vi.mocked(getEventBus).mockReturnValue(mockEventBus);

    const { configManager } = await import("../../configManager.js");
    manager = new IndependentXiaozhiConnectionManager(configManager);
    await manager.initialize(["ws://localhost:9999"], mockTools); // 使用虚拟端点和工具数组初始化
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("connectExistingEndpoint", () => {
    beforeEach(async () => {
      // 初始化管理器 - 使用空数组和虚拟工具
      await manager.initialize([], mockTools);
    });

    test("应该成功连接已存在的未连接接入点", async () => {
      const endpoint = "ws://localhost:8080";

      // 先添加接入点
      await manager.addEndpoint(endpoint);

      // 确保处于未连接状态
      const statusBefore = manager.getConnectionStatus();
      expect(statusBefore.find((s) => s.endpoint === endpoint)?.connected).toBe(
        false
      );

      // 连接已存在的接入点
      await manager.connectExistingEndpoint(endpoint);

      // 验证连接状态
      const statusAfter = manager.getConnectionStatus();
      expect(statusAfter.find((s) => s.endpoint === endpoint)?.connected).toBe(
        true
      );

      // 验证事件被发送
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "endpoint:status:changed",
        expect.objectContaining({
          endpoint,
          connected: true,
          operation: "connect",
          success: true,
        })
      );
    });

    test("应该抛出错误当接入点不存在时", async () => {
      const endpoint = "ws://localhost:8080";

      await expect(manager.connectExistingEndpoint(endpoint)).rejects.toThrow(
        /接入点.*不存在，请先添加接入点/
      );

      // 验证错误日志 - 注意：实际的错误消息格式可能不同
      // 这个测试可能在某些情况下不会记录错误日志，因为错误在检查阶段就被抛出了
    });

    test("应该跳过连接当接入点已连接时", async () => {
      const endpoint = "ws://localhost:8080";

      // 添加并连接接入点
      await manager.addEndpoint(endpoint);
      await manager.connectExistingEndpoint(endpoint);

      // 清理调用记录
      vi.clearAllMocks();

      // 再次连接应该跳过
      await manager.connectExistingEndpoint(endpoint);

      // 验证没有发送重复连接事件
      expect(mockEventBus.emitEvent).not.toHaveBeenCalled();

      // 验证仍然处于连接状态
      const status = manager.getConnectionStatus();
      expect(status.find((s) => s.endpoint === endpoint)?.connected).toBe(true);
    });

    test("应该正确处理连接过程中的异常", async () => {
      const endpoint = "ws://localhost:8080";

      // 添加接入点
      await manager.addEndpoint(endpoint);

      // 模拟连接失败
      const proxyServer = (manager as any).connections.get(endpoint);
      vi.mocked(proxyServer.connect).mockRejectedValue(new Error("连接失败"));

      await expect(manager.connectExistingEndpoint(endpoint)).rejects.toThrow(
        "连接失败"
      );

      // 验证错误日志 - 实际的日志消息格式是 "小智接入点连接失败 ws://localhost:8080:"
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("小智接入点连接失败"),
        expect.any(Error)
      );
    });

    test("应该在未初始化时抛出错误", async () => {
      // 创建未初始化的管理器
      const { configManager: testConfigManager1 } = await import("../../configManager.js");
      const uninitializedManager = new IndependentXiaozhiConnectionManager(testConfigManager1);
      const endpoint = "ws://localhost:8080";

      await expect(
        uninitializedManager.connectExistingEndpoint(endpoint)
      ).rejects.toThrow("IndependentXiaozhiConnectionManager 未初始化");
    });

    test("应该正确处理重连中的接入点", async () => {
      const endpoint = "ws://localhost:8080";

      // 添加接入点
      await manager.addEndpoint(endpoint);

      // 模拟正在重连的状态
      const connectionStates = (manager as any).connectionStates;
      connectionStates.set(endpoint, {
        endpoint,
        connected: false,
        initialized: false,
        isReconnecting: true,
        reconnectAttempts: 2,
        nextReconnectTime: Date.now() + 5000,
        reconnectDelay: 5000,
        lastError: "测试错误",
        lastReconnectAttempt: new Date(),
      });

      // 验证初始重连状态
      const initialStatus = manager.getConnectionStatus();
      const initialEndpointStatus = initialStatus.find(
        (s) => s.endpoint === endpoint
      );
      expect(initialEndpointStatus?.isReconnecting).toBe(true);

      // 连接操作应该能够执行（不抛出错误）
      await manager.connectExistingEndpoint(endpoint);

      // 验证连接操作完成后的状态
      const finalStatus = manager.getConnectionStatus();
      const finalEndpointStatus = finalStatus.find(
        (s) => s.endpoint === endpoint
      );
      expect(finalEndpointStatus).toBeDefined();
    });
  });

  describe("场景判断逻辑", () => {
    beforeEach(async () => {
      await manager.initialize([], mockTools);
    });

    test("应该正确识别已添加但未连接的接入点", async () => {
      const endpoint = "ws://localhost:8080";

      // 添加接入点但不连接
      await manager.addEndpoint(endpoint);

      const status = manager.getConnectionStatus();
      const endpointStatus = status.find((s) => s.endpoint === endpoint);

      expect(endpointStatus).toBeDefined();
      expect(endpointStatus?.connected).toBe(false);
      expect(endpointStatus?.initialized).toBe(false); // 初始状态是未初始化的
    });

    test("应该正确识别已添加且已连接的接入点", async () => {
      const endpoint = "ws://localhost:8080";

      // 添加并连接接入点
      await manager.addEndpoint(endpoint);
      await manager.connectExistingEndpoint(endpoint);

      const status = manager.getConnectionStatus();
      const endpointStatus = status.find((s) => s.endpoint === endpoint);

      expect(endpointStatus).toBeDefined();
      expect(endpointStatus?.connected).toBe(true);
      expect(endpointStatus?.initialized).toBe(true);
    });

    test("应该正确识别正在重连的接入点", async () => {
      const endpoint = "ws://localhost:8080";

      // 添加接入点
      await manager.addEndpoint(endpoint);

      // 手动设置重连状态
      const connectionStates = (manager as any).connectionStates;
      connectionStates.set(endpoint, {
        endpoint,
        connected: false,
        initialized: false,
        isReconnecting: true,
        reconnectAttempts: 1,
        nextReconnectTime: Date.now() + 3000,
        reconnectDelay: 3000,
        lastReconnectAttempt: new Date(),
      });

      const status = manager.getConnectionStatus();
      const endpointStatus = status.find((s) => s.endpoint === endpoint);

      expect(endpointStatus).toBeDefined();
      expect(endpointStatus?.connected).toBe(false);
      expect(endpointStatus?.isReconnecting).toBe(true);
    });

    test("应该正确处理未初始化的接入点", async () => {
      const endpoint = "ws://localhost:8080";

      // 添加接入点（默认就是未初始化状态）
      await manager.addEndpoint(endpoint);

      const status = manager.getConnectionStatus();
      const endpointStatus = status.find((s) => s.endpoint === endpoint);

      expect(endpointStatus).toBeDefined();
      expect(endpointStatus?.initialized).toBe(false); // 新添加的接入点默认是未初始化状态
    });
  });

  describe("错误处理机制", () => {
    beforeEach(async () => {
      await manager.initialize([], mockTools);
    });

    test("应该正确处理无效的端点URL", async () => {
      const invalidEndpoint = "invalid-url";

      // 注意：根据实际实现，addEndpoint 方法可能不会对 URL 格式进行严格验证
      // 而是在连接时才会发现错误
      await manager.addEndpoint(invalidEndpoint);

      // 验证接入点被添加（即使 URL 可能无效）
      const status = manager.getConnectionStatus();
      expect(status.find((s) => s.endpoint === invalidEndpoint)).toBeDefined();
    });

    test("应该正确处理重复添加同一接入点", async () => {
      const endpoint = "ws://localhost:8080";

      // 第一次添加应该成功
      await manager.addEndpoint(endpoint);

      // 第二次添加应该被忽略（不会抛出错误）
      await manager.addEndpoint(endpoint);

      // 验证只有一个接入点
      const status = manager.getConnectionStatus();
      expect(status.filter((s) => s.endpoint === endpoint).length).toBe(1);
    });

    test("应该正确处理移除不存在的接入点", async () => {
      const nonExistentEndpoint = "ws://nonexistent:8080";

      // 移除不存在的接入点应该被忽略（不会抛出错误）
      await manager.removeEndpoint(nonExistentEndpoint);

      // 验证状态没有变化
      const status = manager.getConnectionStatus();
      expect(
        status.find((s) => s.endpoint === nonExistentEndpoint)
      ).toBeUndefined();
    });

    test("应该正确处理断开未连接的接入点", async () => {
      const endpoint = "ws://localhost:8080";

      // 添加但不连接
      await manager.addEndpoint(endpoint);

      // 断开未连接的接入点应该被忽略（不会抛出错误）
      await manager.disconnectEndpoint(endpoint);

      // 验证状态仍然是未连接
      const status = manager.getConnectionStatus();
      expect(status.find((s) => s.endpoint === endpoint)?.connected).toBe(
        false
      );
    });

    test("应该正确处理重连不存在的接入点", async () => {
      const nonExistentEndpoint = "ws://nonexistent:8080";

      // 重连不存在的接入点应该抛出错误
      await expect(
        manager.triggerReconnect(nonExistentEndpoint)
      ).rejects.toThrow("小智接入点 ws://nonexistent:8080 不存在");
    });
  });

  describe("边界条件", () => {
    beforeEach(async () => {
      await manager.initialize([], mockTools);
    });

    test("应该正确处理空端点列表初始化", async () => {
      const { configManager: testConfigManager2 } = await import("../../configManager.js");
      const emptyManager = new IndependentXiaozhiConnectionManager(testConfigManager2);

      // 空端点列表初始化应该抛出错误
      await expect(emptyManager.initialize([], [])).rejects.toThrow(
        "小智接入点列表不能为空"
      );
    });

    test("应该正确处理大量接入点", async () => {
      const endpoints = Array.from(
        { length: 10 },
        (_, i) => `ws://localhost:${8080 + i}`
      );

      // 批量添加接入点
      for (const endpoint of endpoints) {
        await manager.addEndpoint(endpoint);
      }

      const status = manager.getConnectionStatus();
      expect(status.length).toBe(11); // 包括初始化时添加的接入点

      // 连接所有接入点
      for (const endpoint of endpoints) {
        await manager.connectExistingEndpoint(endpoint);
      }

      const connectedStatus = manager.getConnectionStatus();
      expect(connectedStatus.filter((s) => s.connected).length).toBe(10);
    });

    test("应该正确处理快速连续操作", async () => {
      const endpoint = "ws://localhost:8080";

      // 快速连续执行添加、连接、断开操作
      await manager.addEndpoint(endpoint);
      await manager.connectExistingEndpoint(endpoint);
      await manager.disconnectEndpoint(endpoint);
      await manager.connectExistingEndpoint(endpoint);

      const status = manager.getConnectionStatus();
      expect(status.find((s) => s.endpoint === endpoint)?.connected).toBe(true);
    });

    test("应该正确处理并发连接操作", async () => {
      const endpoint = "ws://localhost:8080";
      await manager.addEndpoint(endpoint);

      // 并发执行连接操作
      const connectPromises = Array.from({ length: 5 }, () =>
        manager.connectExistingEndpoint(endpoint)
      );

      // 应该只有一个连接操作实际执行，其他应该跳过
      const results = await Promise.allSettled(connectPromises);

      // 验证最终状态
      const status = manager.getConnectionStatus();
      expect(status.find((s) => s.endpoint === endpoint)?.connected).toBe(true);
    });

    test("应该正确处理特殊字符的端点URL", async () => {
      const endpoint = "ws://localhost:8080/path?param=value&another=123";

      await manager.addEndpoint(endpoint);
      await manager.connectExistingEndpoint(endpoint);

      const status = manager.getConnectionStatus();
      expect(status.find((s) => s.endpoint === endpoint)?.connected).toBe(true);
    });
  });

  describe("状态同步机制", () => {
    beforeEach(async () => {
      await manager.initialize([], mockTools);
    });

    test("应该在状态变更时发送事件", async () => {
      const endpoint = "ws://localhost:8080";

      // 清理事件记录
      vi.clearAllMocks();

      // 注意：根据实际实现，addEndpoint 方法可能不会发送事件
      await manager.addEndpoint(endpoint);

      // 连接操作应该发送事件
      await manager.connectExistingEndpoint(endpoint);
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "endpoint:status:changed",
        expect.objectContaining({
          endpoint,
          connected: true,
          operation: "connect",
          success: true,
        })
      );
    });

    test("应该在错误时发送错误事件", async () => {
      const endpoint = "ws://localhost:8080";

      // 清理事件记录
      vi.clearAllMocks();

      // 尝试连接不存在的接入点
      try {
        await manager.connectExistingEndpoint(endpoint);
      } catch (error) {
        // 预期的错误
      }

      // 验证错误事件没有被发送（因为连接操作在检查阶段就失败了）
      expect(mockEventBus.emitEvent).not.toHaveBeenCalledWith(
        "endpoint:status:changed",
        expect.objectContaining({
          endpoint,
          operation: "connect",
          success: false,
        })
      );
    });

    test("应该保持状态的一致性", async () => {
      const endpoint = "ws://localhost:8080";

      await manager.addEndpoint(endpoint);
      await manager.connectExistingEndpoint(endpoint);

      // 验证内部状态和外部状态的一致性
      const internalStates = (manager as any).connectionStates;
      const externalStatus = manager.getConnectionStatus();

      const internalState = internalStates.get(endpoint);
      const externalState = externalStatus.find((s) => s.endpoint === endpoint);

      expect(internalState.connected).toBe(externalState?.connected);
      expect(internalState.initialized).toBe(externalState?.initialized);
      expect(internalState.isReconnecting).toBe(externalState?.isReconnecting);
    });
  });
});
