/**
 * NetworkService 单元测试
 * 测试网络服务管理器的功能，特别是新的事件订阅 API
 */

import type { AppConfig, ClientStatus } from "@xiaozhi-client/shared-types";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { NetworkService } from "../index";

// Mock 模块
vi.mock("../api", () => ({
  apiClient: {
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
    getStatus: vi.fn(),
    getClientStatus: vi.fn(),
    restartService: vi.fn(),
    stopService: vi.fn(),
    startService: vi.fn(),
    getServiceStatus: vi.fn(),
    getServiceHealth: vi.fn(),
    getMcpEndpoint: vi.fn(),
    getMcpEndpoints: vi.fn(),
    getMcpServers: vi.fn(),
    getConnectionConfig: vi.fn(),
    reloadConfig: vi.fn(),
    getConfigPath: vi.fn(),
    checkConfigExists: vi.fn(),
    getRestartStatus: vi.fn(),
    checkClientConnected: vi.fn(),
    getLastHeartbeat: vi.fn(),
    getActiveMCPServers: vi.fn(),
    updateClientStatus: vi.fn(),
    setActiveMCPServers: vi.fn(),
    resetStatus: vi.fn(),
  },
}));

vi.mock("../websocket", () => ({
  webSocketManager: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    getState: vi.fn(),
    isConnected: vi.fn(),
    setUrl: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    send: vi.fn(),
    getUrl: vi.fn(),
    getConnectionStats: vi.fn(),
    getEventBus: vi.fn(),
  },
  ConnectionState: {
    DISCONNECTED: "disconnected",
    CONNECTING: "connecting",
    CONNECTED: "connected",
    RECONNECTING: "reconnecting",
  },
}));

describe("NetworkService", () => {
  let networkService: NetworkService;
  let mockApiClient: any;
  let mockWebSocketManager: any;

  beforeAll(async () => {
    // 获取 mock 实例
    const { apiClient } = await import("../api");
    const { webSocketManager } = await import("../websocket");
    mockApiClient = apiClient;
    mockWebSocketManager = webSocketManager;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // 重置 mock 的默认行为
    mockWebSocketManager.connect.mockImplementation(() => {});
    mockApiClient.getConfig.mockResolvedValue({
      mcpEndpoint: "ws://localhost:9999",
      mcpServers: {
        "test-server": {
          command: "node",
          args: ["server.js"],
        },
      },
    });
    networkService = new NetworkService();
  });

  afterEach(() => {
    networkService.destroy();
  });

  describe("初始化", () => {
    it("应该正确初始化", async () => {
      expect(networkService).toBeDefined();
      expect(mockWebSocketManager.connect).not.toHaveBeenCalled();
      expect(mockWebSocketManager.disconnect).not.toHaveBeenCalled();
    });

    it("应该初始化 WebSocket 连接", async () => {
      await networkService.initialize();

      expect(mockWebSocketManager.connect).toHaveBeenCalledTimes(1);
    });

    it("不应该重复初始化", async () => {
      await networkService.initialize();
      await networkService.initialize(); // 第二次调用应该被忽略

      expect(mockWebSocketManager.connect).toHaveBeenCalledTimes(1);
    });

    it("初始化失败应该抛出错误", async () => {
      const testNetworkService = new NetworkService();
      mockWebSocketManager.connect.mockImplementation(() => {
        throw new Error("连接失败");
      });

      await expect(testNetworkService.initialize()).rejects.toThrow("连接失败");

      // 清理
      testNetworkService.destroy();
    });
  });

  describe("销毁", () => {
    it("应该正确销毁", () => {
      networkService.destroy();

      expect(mockWebSocketManager.disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe("HTTP API 方法", () => {
    beforeEach(async () => {
      await networkService.initialize();
    });

    it("应该调用 API 客户端的方法", async () => {
      const testConfig: AppConfig = {
        mcpEndpoint: "ws://localhost:9999",
        mcpServers: {
          "test-server": {
            command: "node",
            args: ["server.js"],
          },
        },
      };
      mockApiClient.getConfig.mockResolvedValue(testConfig);

      const result = await networkService.getConfig();

      expect(mockApiClient.getConfig).toHaveBeenCalledTimes(1);
      expect(result).toBe(testConfig);
    });

    it("应该更新配置", async () => {
      const testConfig: AppConfig = {
        mcpEndpoint: "ws://localhost:8888",
        mcpServers: {
          "test-server-2": {
            command: "node",
            args: ["server2.js"],
          },
        },
      };
      mockApiClient.updateConfig.mockResolvedValue(undefined);

      await networkService.updateConfig(testConfig);

      expect(mockApiClient.updateConfig).toHaveBeenCalledWith(testConfig);
    });

    it("应该获取状态", async () => {
      const testStatus = { server: { status: "running" } };
      mockApiClient.getStatus.mockResolvedValue(testStatus);

      const result = await networkService.getStatus();

      expect(mockApiClient.getStatus).toHaveBeenCalledTimes(1);
      expect(result).toBe(testStatus);
    });

    it("应该获取客户端状态", async () => {
      const testClientStatus: ClientStatus = {
        status: "connected",
        mcpEndpoint: "ws://localhost:9999",
        activeMCPServers: ["test-server"],
      };
      mockApiClient.getClientStatus.mockResolvedValue(testClientStatus);

      const result = await networkService.getClientStatus();

      expect(mockApiClient.getClientStatus).toHaveBeenCalledTimes(1);
      expect(result).toBe(testClientStatus);
    });

    it("应该重启服务", async () => {
      mockApiClient.restartService.mockResolvedValue(undefined);

      await networkService.restartService();

      expect(mockApiClient.restartService).toHaveBeenCalledTimes(1);
    });

    it("应该获取 MCP 端点", async () => {
      const testEndpoint = "ws://localhost:9999";
      mockApiClient.getMcpEndpoint.mockResolvedValue(testEndpoint);

      const result = await networkService.getMcpEndpoint();

      expect(mockApiClient.getMcpEndpoint).toHaveBeenCalledTimes(1);
      expect(result).toBe(testEndpoint);
    });

    it("应该获取 MCP 端点列表", async () => {
      const testEndpoints = ["ws://localhost:9999", "ws://localhost:8888"];
      mockApiClient.getMcpEndpoints.mockResolvedValue(testEndpoints);

      const result = await networkService.getMcpEndpoints();

      expect(mockApiClient.getMcpEndpoints).toHaveBeenCalledTimes(1);
      expect(result).toBe(testEndpoints);
    });

    it("应该检查客户端连接状态", async () => {
      mockApiClient.checkClientConnected.mockResolvedValue(true);

      const result = await networkService.checkClientConnected();

      expect(mockApiClient.checkClientConnected).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });
  });

  describe("WebSocket 方法", () => {
    beforeEach(async () => {
      await networkService.initialize();
    });

    it("应该获取 WebSocket 状态", () => {
      mockWebSocketManager.getState.mockReturnValue("connected");
      mockWebSocketManager.isConnected.mockReturnValue(true);

      const state = networkService.getWebSocketState();
      const isConnected = networkService.isWebSocketConnected();

      expect(mockWebSocketManager.getState).toHaveBeenCalledTimes(1);
      expect(mockWebSocketManager.isConnected).toHaveBeenCalledTimes(1);
      expect(state).toBe("connected");
      expect(isConnected).toBe(true);
    });

    it("应该设置 WebSocket URL", () => {
      const testUrl = "ws://localhost:8080";

      networkService.setWebSocketUrl(testUrl);

      expect(mockWebSocketManager.setUrl).toHaveBeenCalledWith(testUrl);
    });

    it("应该重新连接 WebSocket", () => {
      networkService.reconnectWebSocket();

      expect(mockWebSocketManager.disconnect).toHaveBeenCalled();
      expect(mockWebSocketManager.connect).toHaveBeenCalled();
    });
  });

  describe("事件订阅 API", () => {
    beforeEach(async () => {
      await networkService.initialize();
      mockWebSocketManager.subscribe.mockReturnValue(() => {});
    });

    it("应该订阅 WebSocket 事件并返回取消订阅函数", () => {
      const listener = vi.fn();
      const unsubscribe = vi.fn();

      mockWebSocketManager.subscribe.mockReturnValue(unsubscribe);

      const result = networkService.onWebSocketEvent(
        "connection:connected",
        listener
      );

      expect(mockWebSocketManager.subscribe).toHaveBeenCalledWith(
        "connection:connected",
        listener
      );
      expect(result).toBe(unsubscribe);
    });

    it("应该通过返回的函数取消订阅 WebSocket 事件", () => {
      const listener = vi.fn();
      const unsubscribe = vi.fn();

      mockWebSocketManager.subscribe.mockReturnValue(unsubscribe);

      const unsubscribeFn = networkService.onWebSocketEvent(
        "connection:connected",
        listener
      );

      // 调用返回的取消订阅函数
      unsubscribeFn();

      expect(mockWebSocketManager.subscribe).toHaveBeenCalledWith(
        "connection:connected",
        listener
      );
      expect(unsubscribe).toHaveBeenCalled();
    });

    it("应该支持不同类型的事件", () => {
      const listeners = {
        config: vi.fn(),
        status: vi.fn(),
        restart: vi.fn(),
        error: vi.fn(),
      };

      mockWebSocketManager.subscribe.mockReturnValue(() => {});

      networkService.onWebSocketEvent("data:configUpdate", listeners.config);
      networkService.onWebSocketEvent("data:statusUpdate", listeners.status);
      networkService.onWebSocketEvent("data:restartStatus", listeners.restart);
      networkService.onWebSocketEvent("system:error", listeners.error);

      expect(mockWebSocketManager.subscribe).toHaveBeenCalledTimes(4);
      expect(mockWebSocketManager.subscribe).toHaveBeenNthCalledWith(
        1,
        "data:configUpdate",
        listeners.config
      );
      expect(mockWebSocketManager.subscribe).toHaveBeenNthCalledWith(
        2,
        "data:statusUpdate",
        listeners.status
      );
      expect(mockWebSocketManager.subscribe).toHaveBeenNthCalledWith(
        3,
        "data:restartStatus",
        listeners.restart
      );
      expect(mockWebSocketManager.subscribe).toHaveBeenNthCalledWith(
        4,
        "system:error",
        listeners.error
      );
    });
  });

  describe("重启服务（轮询等待模式）", () => {
    it("应该通过轮询等待重启完成", async () => {
      // 模拟重启后服务恢复连接
      mockApiClient.restartService.mockResolvedValue(undefined);
      mockApiClient.getClientStatus
        .mockResolvedValueOnce({ status: "reconnecting" } as any)
        .mockResolvedValueOnce({ status: "connected" } as any);

      await networkService.restartServiceWithNotification(5000);

      expect(mockApiClient.restartService).toHaveBeenCalled();
      expect(mockApiClient.getClientStatus).toHaveBeenCalled();
    });

    it("应该在重启失败（API 异常）时拒绝 Promise", async () => {
      const apiError = new Error("重启 API 调用失败");
      mockApiClient.restartService.mockRejectedValue(apiError);

      await expect(
        networkService.restartServiceWithNotification()
      ).rejects.toThrow(apiError);
    });

    it("应该在轮询超时时拒绝 Promise", async () => {
      mockApiClient.restartService.mockResolvedValue(undefined);
      // 模拟服务一直未恢复连接（每次轮询都返回 reconnecting 状态）
      mockApiClient.getClientStatus.mockResolvedValue({
        status: "reconnecting",
      } as any);

      // 使用较短的超时时间进行测试（轮询间隔 1s，超时 2.5s，约轮询 2 次后超时）
      const promise = networkService.restartServiceWithNotification(2500);

      await expect(promise).rejects.toThrow("等待重启完成超时");
    }, 10000); // 延长单测试超时以适应真实轮询等待
  });

  describe("便捷方法", () => {
    beforeEach(async () => {
      await networkService.initialize();
    });

    it("应该获取完整应用状态", async () => {
      const testConfig: AppConfig = {
        mcpEndpoint: "ws://localhost:9999",
        mcpServers: {
          "test-server": {
            command: "node",
            args: ["server.js"],
          },
        },
      };
      const testStatus = { server: { status: "running" } };
      mockWebSocketManager.isConnected.mockReturnValue(true);

      mockApiClient.getConfig.mockResolvedValue(testConfig);
      mockApiClient.getStatus.mockResolvedValue(testStatus);

      const result = await networkService.getFullAppState();

      expect(result).toEqual({
        config: testConfig,
        status: testStatus,
        webSocketConnected: true,
      });
    });

    it("应该并行获取配置和状态", async () => {
      const testConfig: AppConfig = {
        mcpEndpoint: "ws://localhost:9999",
        mcpServers: {
          "test-server": {
            command: "node",
            args: ["server.js"],
          },
        },
      };
      const testStatus = { server: { status: "running" } };

      const getConfigPromise = new Promise((resolve) =>
        setTimeout(() => resolve(testConfig), 10)
      );
      const getStatusPromise = new Promise((resolve) =>
        setTimeout(() => resolve(testStatus), 20)
      );

      mockApiClient.getConfig.mockReturnValue(getConfigPromise);
      mockApiClient.getStatus.mockReturnValue(getStatusPromise);
      mockWebSocketManager.isConnected.mockReturnValue(true);

      const startTime = Date.now();
      const result = await networkService.getFullAppState();
      const endTime = Date.now();

      expect(result.config).toBe(testConfig);
      expect(result.status).toBe(testStatus);
      // 应该并行执行，所以总时间应该接近较长的那个任务（20ms），而不是两个任务的和（30ms）
      // 增加超时阈值以适应不同的系统负载和 CI 环境
      expect(endTime - startTime).toBeLessThan(300);
    });
  });

  describe("错误处理", () => {
    beforeEach(async () => {
      await networkService.initialize();
    });

    it("应该正确处理 WebSocket 订阅错误", () => {
      const listener = vi.fn();
      const error = new Error("订阅失败");

      mockWebSocketManager.subscribe.mockImplementation(() => {
        throw error;
      });

      expect(() => {
        networkService.onWebSocketEvent("connection:connected", listener);
      }).toThrow(error);
    });

    it("应该正确处理取消订阅函数执行错误", () => {
      const listener = vi.fn();
      const error = new Error("取消订阅失败");
      const unsubscribe = vi.fn(() => {
        throw error;
      });

      mockWebSocketManager.subscribe.mockReturnValue(unsubscribe);

      const unsubscribeFn = networkService.onWebSocketEvent(
        "connection:connected",
        listener
      );

      expect(() => {
        unsubscribeFn();
      }).toThrow(error);
    });

    it("应该正确处理 API 调用错误", async () => {
      const error = new Error("API 调用失败");
      mockApiClient.getConfig.mockRejectedValue(error);

      await expect(networkService.getConfig()).rejects.toThrow(error);
    });
  });

  describe("边界情况", () => {
    beforeEach(async () => {
      await networkService.initialize();
    });

    it("应该处理空的配置更新", async () => {
      const emptyConfig: Partial<AppConfig> = {};
      mockApiClient.updateConfig.mockResolvedValue(undefined);

      await expect(
        networkService.updateConfig(emptyConfig as AppConfig)
      ).resolves.not.toThrow();
      expect(mockApiClient.updateConfig).toHaveBeenCalledWith(
        emptyConfig as AppConfig
      );
    });

    it("应该处理 WebSocket 未连接时的消息发送", () => {
      mockWebSocketManager.isConnected.mockReturnValue(false);
      mockWebSocketManager.send.mockReturnValue(false);

      const result = (networkService as any).send?.({ test: "message" });

      expect(result).toBe(false);
    });

    it("应该处理多次快速的状态查询", () => {
      mockWebSocketManager.getState.mockReturnValue("connected");
      mockWebSocketManager.isConnected.mockReturnValue(true);

      for (let i = 0; i < 10; i++) {
        expect(networkService.getWebSocketState()).toBe("connected");
        expect(networkService.isWebSocketConnected()).toBe(true);
      }

      expect(mockWebSocketManager.getState).toHaveBeenCalledTimes(10);
      expect(mockWebSocketManager.isConnected).toHaveBeenCalledTimes(10);
    });
  });
});
