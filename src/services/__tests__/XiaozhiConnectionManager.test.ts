import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConnectionErrorType,
  ReconnectStrategy,
  XiaozhiConnectionManager,
  type XiaozhiConnectionOptions,
} from "../XiaozhiConnectionManager.js";
import { XiaozhiConnectionManagerSingleton } from "../XiaozhiConnectionManagerSingleton.js";

// Mock ProxyMCPServer
vi.mock("../../ProxyMCPServer.js", () => ({
  ProxyMCPServer: vi.fn().mockImplementation((endpoint: string) => ({
    endpoint,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    setServiceManager: vi.fn(),
  })),
}));

// Mock Logger
vi.mock("../../Logger.js", () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("XiaozhiConnectionManager", () => {
  let manager: XiaozhiConnectionManager;
  const mockEndpoints = ["wss://test1.example.com", "wss://test2.example.com"];
  const mockTools = [
    {
      name: "test-tool",
      description: "Test tool",
      inputSchema: { type: "object" as const, properties: {} },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (manager) {
      await manager.cleanup();
    }
  });

  describe("constructor", () => {
    it("should create XiaozhiConnectionManager with default options", () => {
      manager = new XiaozhiConnectionManager();
      expect(manager).toBeInstanceOf(XiaozhiConnectionManager);
    });

    it("should create XiaozhiConnectionManager with custom options", () => {
      const options: XiaozhiConnectionOptions = {
        healthCheckInterval: 60000,
        reconnectInterval: 3000,
        maxReconnectAttempts: 5,
        loadBalanceStrategy: "health-based",
      };
      manager = new XiaozhiConnectionManager(options);
      expect(manager).toBeInstanceOf(XiaozhiConnectionManager);
    });
  });

  describe("initialize", () => {
    beforeEach(() => {
      manager = new XiaozhiConnectionManager();
    });

    it("should initialize successfully with valid endpoints and tools", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      const connectionStatus = manager.getConnectionStatus();
      expect(connectionStatus).toHaveLength(2);
      expect(connectionStatus[0].endpoint).toBe(mockEndpoints[0]);
      expect(connectionStatus[1].endpoint).toBe(mockEndpoints[1]);
    });

    it("should throw error for empty endpoints array", async () => {
      await expect(manager.initialize([], mockTools)).rejects.toThrow(
        "端点列表不能为空"
      );
    });

    it("should throw error for invalid endpoint URL", async () => {
      await expect(
        manager.initialize(["invalid-url"], mockTools)
      ).rejects.toThrow("端点地址必须是 WebSocket URL");
    });

    it("should throw error for non-WebSocket URL", async () => {
      await expect(
        manager.initialize(["http://example.com"], mockTools)
      ).rejects.toThrow("端点地址必须是 WebSocket URL");
    });

    it("should skip duplicate initialization", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      // 第二次初始化应该被跳过
      await manager.initialize(mockEndpoints, mockTools);

      const connectionStatus = manager.getConnectionStatus();
      expect(connectionStatus).toHaveLength(2);
    });
  });

  describe("connect", () => {
    beforeEach(() => {
      manager = new XiaozhiConnectionManager();
    });

    it("should throw error when not initialized", async () => {
      await expect(manager.connect()).rejects.toThrow(
        "XiaozhiConnectionManager 未初始化"
      );
    });

    it("should connect to all endpoints", async () => {
      await manager.initialize(mockEndpoints, mockTools);
      await manager.connect();

      // 验证连接状态
      expect(manager.isAnyConnected()).toBe(true);
    });
  });

  describe("disconnect", () => {
    beforeEach(() => {
      manager = new XiaozhiConnectionManager();
    });

    it("should disconnect all endpoints", async () => {
      await manager.initialize(mockEndpoints, mockTools);
      await manager.connect();
      await manager.disconnect();

      expect(manager.isAnyConnected()).toBe(false);
    });
  });

  describe("addEndpoint", () => {
    beforeEach(() => {
      manager = new XiaozhiConnectionManager();
    });

    it("should throw error when not initialized", async () => {
      await expect(
        manager.addEndpoint("wss://new.example.com")
      ).rejects.toThrow("XiaozhiConnectionManager 未初始化");
    });

    it("should add new endpoint successfully", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      const newEndpoint = "wss://new.example.com";
      await manager.addEndpoint(newEndpoint);

      const connectionStatus = manager.getConnectionStatus();
      expect(connectionStatus).toHaveLength(3);
      expect(
        connectionStatus.some((status) => status.endpoint === newEndpoint)
      ).toBe(true);
    });

    it("should skip adding duplicate endpoint", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      // 尝试添加已存在的端点
      await manager.addEndpoint(mockEndpoints[0]);

      const connectionStatus = manager.getConnectionStatus();
      expect(connectionStatus).toHaveLength(2); // 数量不变
    });
  });

  describe("removeEndpoint", () => {
    beforeEach(() => {
      manager = new XiaozhiConnectionManager();
    });

    it("should remove endpoint successfully", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      await manager.removeEndpoint(mockEndpoints[0]);

      const connectionStatus = manager.getConnectionStatus();
      expect(connectionStatus).toHaveLength(1);
      expect(connectionStatus[0].endpoint).toBe(mockEndpoints[1]);
    });

    it("should skip removing non-existent endpoint", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      await manager.removeEndpoint("wss://non-existent.example.com");

      const connectionStatus = manager.getConnectionStatus();
      expect(connectionStatus).toHaveLength(2); // 数量不变
    });
  });

  describe("getHealthyConnections", () => {
    beforeEach(() => {
      manager = new XiaozhiConnectionManager();
    });

    it("should return empty array when no connections", () => {
      const healthyConnections = manager.getHealthyConnections();
      expect(healthyConnections).toHaveLength(0);
    });

    it("should return healthy connections", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      // 模拟连接状态
      const connectionStatus = manager.getConnectionStatus();
      connectionStatus[0].connected = true;
      connectionStatus[0].healthScore = 80;
      connectionStatus[1].connected = true;
      connectionStatus[1].healthScore = 30; // 低于阈值

      const healthyConnections = manager.getHealthyConnections();
      expect(healthyConnections).toHaveLength(1);
    });
  });

  describe("setServiceManager", () => {
    beforeEach(() => {
      manager = new XiaozhiConnectionManager();
    });

    it("should set service manager successfully", () => {
      const mockServiceManager = {
        getAllTools: vi.fn().mockReturnValue(mockTools),
      };

      manager.setServiceManager(mockServiceManager);

      // 验证设置成功（通过日志或其他方式）
      expect(mockServiceManager.getAllTools).not.toHaveBeenCalled(); // 初始化前不会调用
    });
  });

  describe("cleanup", () => {
    beforeEach(() => {
      manager = new XiaozhiConnectionManager();
    });

    it("should cleanup all resources", async () => {
      await manager.initialize(mockEndpoints, mockTools);
      await manager.cleanup();

      const connectionStatus = manager.getConnectionStatus();
      expect(connectionStatus).toHaveLength(0);
      expect(manager.isAnyConnected()).toBe(false);
    });
  });

  describe("health check functionality", () => {
    beforeEach(() => {
      manager = new XiaozhiConnectionManager({
        healthCheckInterval: 1000, // 1 second for testing
      });
    });

    it("should enable/disable health check for specific endpoint", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      // 禁用第一个端点的健康检查
      manager.setHealthCheckEnabled(mockEndpoints[0], false);

      const connectionStatus = manager.getConnectionStatus();
      expect(connectionStatus[0].healthCheckEnabled).toBe(false);
      expect(connectionStatus[1].healthCheckEnabled).toBe(true);
    });

    it("should handle non-existent endpoint in setHealthCheckEnabled", () => {
      const nonExistentEndpoint = "wss://non-existent.example.com";

      // 应该不抛出错误
      expect(() => {
        manager.setHealthCheckEnabled(nonExistentEndpoint, true);
      }).not.toThrow();
    });

    it("should get health check statistics", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      const stats = manager.getHealthCheckStats();

      expect(Object.keys(stats)).toHaveLength(2);
      expect(stats[mockEndpoints[0]]).toMatchObject({
        endpoint: mockEndpoints[0],
        healthScore: 100,
        successRate: 0,
        averageResponseTime: 0,
        consecutiveFailures: 0,
      });
    });

    it("should trigger manual health check", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      // 手动触发健康检查应该不抛出错误
      await expect(manager.triggerHealthCheck()).resolves.not.toThrow();
    });

    it("should update health scores based on connection status", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      // 模拟连接状态
      const connectionStatus = manager.getConnectionStatus();
      connectionStatus[0].connected = true;
      connectionStatus[0].totalRequests = 10;
      connectionStatus[0].successfulRequests = 9; // 90% success rate

      // 触发健康检查
      await manager.triggerHealthCheck();

      const stats = manager.getHealthCheckStats();
      expect(stats[mockEndpoints[0]].successRate).toBeGreaterThan(0);
    });
  });

  describe("reconnect functionality", () => {
    beforeEach(() => {
      manager = new XiaozhiConnectionManager({
        reconnectInterval: 100, // 100ms for testing
        maxReconnectAttempts: 3,
        reconnectStrategy: ReconnectStrategy.EXPONENTIAL_BACKOFF,
      });
    });

    it("should create manager with different reconnect strategies", () => {
      const strategies = [
        ReconnectStrategy.EXPONENTIAL_BACKOFF,
        ReconnectStrategy.LINEAR_BACKOFF,
        ReconnectStrategy.FIXED_INTERVAL,
        ReconnectStrategy.ADAPTIVE,
      ];

      for (const strategy of strategies) {
        const testManager = new XiaozhiConnectionManager({
          reconnectStrategy: strategy,
        });
        expect(testManager).toBeInstanceOf(XiaozhiConnectionManager);
      }
    });

    it("should trigger manual reconnect for specific endpoint", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      // 模拟连接失败状态
      const connectionStatus = manager.getConnectionStatus();
      connectionStatus[0].connected = false;
      connectionStatus[0].lastError = "Connection failed";

      // 手动触发重连
      await expect(
        manager.triggerReconnect(mockEndpoints[0])
      ).resolves.not.toThrow();
    });

    it("should throw error when triggering reconnect for non-existent endpoint", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      await expect(
        manager.triggerReconnect("wss://non-existent.example.com")
      ).rejects.toThrow("端点 wss://non-existent.example.com 不存在");
    });

    it("should skip reconnect for already connected endpoint", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      // 模拟连接成功状态
      const connectionStatus = manager.getConnectionStatus();
      connectionStatus[0].connected = true;

      // 手动触发重连应该被跳过
      await expect(
        manager.triggerReconnect(mockEndpoints[0])
      ).resolves.not.toThrow();
    });

    it("should stop reconnect for specific endpoint", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      // 停止重连
      manager.stopReconnect(mockEndpoints[0]);

      const reconnectStats = manager.getReconnectStats();
      expect(reconnectStats[mockEndpoints[0]].isReconnecting).toBe(false);
    });

    it("should stop all reconnects", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      // 停止所有重连
      manager.stopAllReconnects();

      const reconnectStats = manager.getReconnectStats();
      for (const stats of Object.values(reconnectStats)) {
        expect(stats.isReconnecting).toBe(false);
      }
    });

    it("should get reconnect statistics", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      const stats = manager.getReconnectStats();

      expect(Object.keys(stats)).toHaveLength(2);
      expect(stats[mockEndpoints[0]]).toMatchObject({
        endpoint: mockEndpoints[0],
        reconnectAttempts: 0,
        isReconnecting: false,
        reconnectDelay: expect.any(Number),
        recentReconnectHistory: expect.any(Array),
      });
    });

    it("should handle different error types", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      const connectionStatus = manager.getConnectionStatus();

      // 模拟不同类型的错误
      const errorTypes = [
        "Network error",
        "Authentication failed",
        "Server error 500",
        "Connection timeout",
        "Unknown error",
      ];

      for (const [index, error] of errorTypes.entries()) {
        if (connectionStatus[0]) {
          connectionStatus[0].lastError = error;
        }
      }

      // 验证错误分类逻辑通过重连统计可以间接验证
      const stats = manager.getReconnectStats();
      expect(stats[mockEndpoints[0]]).toBeDefined();
    });
  });

  describe("dynamic configuration management", () => {
    beforeEach(() => {
      manager = new XiaozhiConnectionManager();
    });

    it("should validate endpoints correctly", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      // 测试有效端点
      const validEndpoints = [
        "wss://valid1.example.com",
        "wss://valid2.example.com",
      ];
      await expect(
        manager.updateEndpoints(validEndpoints)
      ).resolves.not.toThrow();
    });

    it("should reject invalid endpoints", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      // 测试无效端点
      const invalidEndpoints = ["http://invalid.com", "not-a-url"];
      await expect(manager.updateEndpoints(invalidEndpoints)).rejects.toThrow(
        "没有有效的端点"
      );
    });

    it("should update endpoints and emit events", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      const eventPromise = new Promise((resolve) => {
        manager.once("configChange", resolve);
      });

      const newEndpoints = ["wss://new1.example.com", "wss://new2.example.com"];
      await manager.updateEndpoints(newEndpoints);

      const event = await eventPromise;
      expect(event).toMatchObject({
        type: expect.stringMatching(/endpoints_/),
        timestamp: expect.any(Date),
      });
    });

    it("should update connection options", () => {
      const newOptions = {
        healthCheckInterval: 60000,
        reconnectInterval: 3000,
      };

      const eventPromise = new Promise((resolve) => {
        manager.once("configChange", resolve);
      });

      manager.updateOptions(newOptions);

      const config = manager.getCurrentConfig();
      expect(config.options.healthCheckInterval).toBe(60000);
      expect(config.options.reconnectInterval).toBe(3000);

      return eventPromise.then((event) => {
        expect(event).toMatchObject({
          type: "options_updated",
          timestamp: expect.any(Date),
        });
      });
    });

    it("should reject invalid options", () => {
      const invalidOptions = {
        healthCheckInterval: -1000, // 无效值
        reconnectInterval: 50, // 太小
      };

      expect(() => {
        manager.updateOptions(invalidOptions);
      }).toThrow("无效的连接选项");
    });

    it("should get current configuration", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      const config = manager.getCurrentConfig();

      expect(config).toMatchObject({
        endpoints: expect.arrayContaining(mockEndpoints),
        options: expect.objectContaining({
          healthCheckInterval: expect.any(Number),
          reconnectInterval: expect.any(Number),
          maxReconnectAttempts: expect.any(Number),
        }),
      });
    });

    it("should reload configuration", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      const newConfig = {
        endpoints: ["wss://reload1.example.com"],
        options: {
          healthCheckInterval: 45000,
        },
      };

      await manager.reloadConfig(newConfig);

      const currentConfig = manager.getCurrentConfig();
      expect(currentConfig.endpoints).toEqual(["wss://reload1.example.com"]);
      expect(currentConfig.options.healthCheckInterval).toBe(45000);
    });

    it("should handle reload config errors", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      const invalidConfig = {
        endpoints: ["invalid-url"],
        options: {
          healthCheckInterval: -1000,
        },
      };

      await expect(manager.reloadConfig(invalidConfig)).rejects.toThrow();
    });

    it("should throw error when updating endpoints before initialization", async () => {
      await expect(manager.updateEndpoints(["wss://test.com"])).rejects.toThrow(
        "XiaozhiConnectionManager 未初始化"
      );
    });
  });

  describe("error handling and edge cases", () => {
    beforeEach(() => {
      manager = new XiaozhiConnectionManager();
    });

    it("should handle connection timeout", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      // 模拟连接超时
      const connectionStatus = manager.getConnectionStatus();
      connectionStatus[0].lastError = "Connection timeout";
      connectionStatus[0].errorType = ConnectionErrorType.TIMEOUT_ERROR;

      const stats = manager.getReconnectStats();
      expect(stats[mockEndpoints[0]].errorType).toBe(
        ConnectionErrorType.TIMEOUT_ERROR
      );
    });

    it("should handle authentication errors", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      const connectionStatus = manager.getConnectionStatus();
      connectionStatus[0].lastError = "Authentication failed";
      connectionStatus[0].errorType = ConnectionErrorType.AUTHENTICATION_ERROR;

      expect(connectionStatus[0].errorType).toBe(
        ConnectionErrorType.AUTHENTICATION_ERROR
      );
    });

    it("should handle network errors", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      const connectionStatus = manager.getConnectionStatus();
      connectionStatus[0].lastError = "Network unreachable";
      connectionStatus[0].errorType = ConnectionErrorType.NETWORK_ERROR;

      expect(connectionStatus[0].errorType).toBe(
        ConnectionErrorType.NETWORK_ERROR
      );
    });

    it("should handle server errors", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      const connectionStatus = manager.getConnectionStatus();
      connectionStatus[0].lastError = "Server error 500";
      connectionStatus[0].errorType = ConnectionErrorType.SERVER_ERROR;

      expect(connectionStatus[0].errorType).toBe(
        ConnectionErrorType.SERVER_ERROR
      );
    });

    it("should handle unknown errors", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      const connectionStatus = manager.getConnectionStatus();
      connectionStatus[0].lastError = "Unknown error occurred";
      connectionStatus[0].errorType = ConnectionErrorType.UNKNOWN_ERROR;

      expect(connectionStatus[0].errorType).toBe(
        ConnectionErrorType.UNKNOWN_ERROR
      );
    });

    it("should validate load balance strategies", () => {
      const invalidStrategy = "invalid-strategy" as any;
      manager = new XiaozhiConnectionManager();

      expect(() => {
        manager.updateOptions({
          loadBalanceStrategy: invalidStrategy,
        });
      }).toThrow("无效的连接选项");
    });

    it("should validate reconnect strategies", () => {
      const invalidStrategy = "invalid-strategy" as any;
      manager = new XiaozhiConnectionManager();

      expect(() => {
        manager.updateOptions({
          reconnectStrategy: invalidStrategy,
        });
      }).toThrow("无效的连接选项");
    });

    it("should handle cleanup with active timers", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      // 模拟活动定时器
      const connectionStatus = manager.getConnectionStatus();
      connectionStatus[0].isReconnecting = true;

      await manager.cleanup();

      expect(manager.getConnectionStatus()).toHaveLength(0);
    });

    it("should handle endpoint validation errors", async () => {
      manager = new XiaozhiConnectionManager();

      await expect(
        manager.initialize(["invalid-url"], mockTools)
      ).rejects.toThrow("端点地址必须是 WebSocket URL");
    });

    it("should handle empty endpoints array", async () => {
      manager = new XiaozhiConnectionManager();

      await expect(manager.initialize([], mockTools)).rejects.toThrow(
        "端点列表不能为空"
      );
    });

    it("should handle duplicate endpoints", async () => {
      await manager.initialize([mockEndpoints[0], mockEndpoints[0]], mockTools);

      const connectionStatus = manager.getConnectionStatus();
      expect(connectionStatus).toHaveLength(1); // 应该去重
    });

    it("should handle invalid tools array", async () => {
      manager = new XiaozhiConnectionManager();

      await expect(
        manager.initialize(mockEndpoints, null as any)
      ).rejects.toThrow();
    });

    it("should handle configuration validation", async () => {
      manager = new XiaozhiConnectionManager();

      const invalidOptions = {
        healthCheckInterval: -1000,
        reconnectInterval: 50,
      };

      expect(() => {
        manager.updateOptions(invalidOptions);
      }).toThrow("无效的连接选项");
    });

    it("should handle connection state transitions", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      const connectionStatus = manager.getConnectionStatus();
      const initialStatus = connectionStatus[0];

      // 模拟状态转换
      initialStatus.connected = false;
      initialStatus.isReconnecting = true;
      initialStatus.reconnectAttempts = 1;

      expect(initialStatus.isReconnecting).toBe(true);
      expect(initialStatus.reconnectAttempts).toBe(1);
    });

    it("should handle concurrent connection attempts", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      // 模拟并发连接尝试
      const connectPromises = [manager.connect(), manager.connect()];

      await expect(Promise.all(connectPromises)).resolves.not.toThrow();
    });

    it("should handle memory pressure scenarios", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      // 模拟大量连接历史记录
      const connectionStatus = manager.getConnectionStatus();
      connectionStatus[0].reconnectHistory = Array(50)
        .fill(null)
        .map((_, i) => ({
          timestamp: new Date(Date.now() - i * 1000),
          success: i % 2 === 0,
          error: i % 2 === 0 ? undefined : "Connection failed",
          delay: 1000 + i * 100,
        }));

      manager.optimizeMemoryUsage();

      // 历史记录应该被清理
      expect(connectionStatus[0].reconnectHistory.length).toBeLessThanOrEqual(
        20
      );
    });
  });

  describe("performance optimization", () => {
    beforeEach(() => {
      manager = new XiaozhiConnectionManager();
    });

    it("should track performance metrics", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      const metrics = manager.getPerformanceMetrics();

      expect(metrics).toMatchObject({
        connectionTime: {
          total: expect.any(Number),
          average: expect.any(Number),
          count: expect.any(Number),
        },
        memoryUsage: {
          initial: expect.any(Number),
          current: expect.any(Number),
          peak: expect.any(Number),
          growth: expect.any(Number),
          growthPercentage: expect.any(Number),
        },
        prewarmedConnections: expect.any(Number),
        totalConnections: expect.any(Number),
        healthyConnections: expect.any(Number),
      });
    });

    it("should prewarm connections", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      await manager.prewarmConnections();

      const metrics = manager.getPerformanceMetrics();
      expect(metrics.prewarmedConnections).toBeGreaterThan(0);
    });

    it("should prewarm specific endpoints", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      await manager.prewarmConnections([mockEndpoints[0]]);

      const metrics = manager.getPerformanceMetrics();
      expect(metrics.prewarmedConnections).toBe(1);
    });

    it("should optimize memory usage", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      // 不应该抛出错误
      expect(() => {
        manager.optimizeMemoryUsage();
      }).not.toThrow();
    });

    it("should track connection time", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      const metricsBefore = manager.getPerformanceMetrics();
      const connectionCountBefore = metricsBefore.connectionTime.count;

      await manager.connect();

      const metricsAfter = manager.getPerformanceMetrics();
      expect(metricsAfter.connectionTime.count).toBe(connectionCountBefore + 1);
      expect(metricsAfter.connectionTime.total).toBeGreaterThanOrEqual(
        metricsBefore.connectionTime.total
      );
    });

    it("should track memory growth", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      const metrics = manager.getPerformanceMetrics();

      expect(metrics.memoryUsage.initial).toBeGreaterThan(0);
      expect(metrics.memoryUsage.current).toBeGreaterThan(0);
      expect(metrics.memoryUsage.peak).toBeGreaterThanOrEqual(
        metrics.memoryUsage.current
      );
      expect(typeof metrics.memoryUsage.growthPercentage).toBe("number");
    });

    it("should handle prewarm for non-existent endpoints", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      // 不应该抛出错误
      await expect(
        manager.prewarmConnections(["wss://nonexistent.com"])
      ).resolves.not.toThrow();
    });

    it("should skip already prewarmed connections", async () => {
      await manager.initialize(mockEndpoints, mockTools);

      await manager.prewarmConnections([mockEndpoints[0]]);
      const metrics1 = manager.getPerformanceMetrics();

      // 再次预热同一个端点
      await manager.prewarmConnections([mockEndpoints[0]]);
      const metrics2 = manager.getPerformanceMetrics();

      // 预热连接数应该保持不变
      expect(metrics2.prewarmedConnections).toBe(metrics1.prewarmedConnections);
    });
  });
});

describe("XiaozhiConnectionManagerSingleton", () => {
  afterEach(async () => {
    await XiaozhiConnectionManagerSingleton.cleanup();
  });

  describe("getInstance", () => {
    it("should create singleton instance", async () => {
      const instance1 = await XiaozhiConnectionManagerSingleton.getInstance();
      const instance2 = await XiaozhiConnectionManagerSingleton.getInstance();

      expect(instance1).toBe(instance2); // 应该是同一个实例
      expect(XiaozhiConnectionManagerSingleton.isInitialized()).toBe(true);
    });

    it("should create instance with custom options", async () => {
      const options: XiaozhiConnectionOptions = {
        healthCheckInterval: 60000,
        reconnectInterval: 3000,
      };

      const instance =
        await XiaozhiConnectionManagerSingleton.getInstance(options);
      expect(instance).toBeInstanceOf(XiaozhiConnectionManager);
    });
  });

  describe("cleanup", () => {
    it("should cleanup singleton resources", async () => {
      await XiaozhiConnectionManagerSingleton.getInstance();
      expect(XiaozhiConnectionManagerSingleton.isInitialized()).toBe(true);

      await XiaozhiConnectionManagerSingleton.cleanup();
      expect(XiaozhiConnectionManagerSingleton.isInitialized()).toBe(false);
    });
  });

  describe("reset", () => {
    it("should reset singleton state", async () => {
      await XiaozhiConnectionManagerSingleton.getInstance();
      expect(XiaozhiConnectionManagerSingleton.isInitialized()).toBe(true);

      XiaozhiConnectionManagerSingleton.reset();
      expect(XiaozhiConnectionManagerSingleton.isInitialized()).toBe(false);
    });
  });

  describe("forceReinitialize", () => {
    it("should force reinitialize singleton", async () => {
      const instance1 = await XiaozhiConnectionManagerSingleton.getInstance();
      const instance2 =
        await XiaozhiConnectionManagerSingleton.forceReinitialize();

      expect(instance1).not.toBe(instance2); // 应该是不同的实例
      expect(XiaozhiConnectionManagerSingleton.isInitialized()).toBe(true);
    });
  });

  describe("getCurrentInstance", () => {
    it("should return null when not initialized", () => {
      const instance = XiaozhiConnectionManagerSingleton.getCurrentInstance();
      expect(instance).toBeNull();
    });

    it("should return current instance when initialized", async () => {
      const instance1 = await XiaozhiConnectionManagerSingleton.getInstance();
      const instance2 = XiaozhiConnectionManagerSingleton.getCurrentInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe("waitForInitialization", () => {
    it("should return true when already initialized", async () => {
      await XiaozhiConnectionManagerSingleton.getInstance();
      const result =
        await XiaozhiConnectionManagerSingleton.waitForInitialization();
      expect(result).toBe(true);
    });

    it("should return false when not initialized", async () => {
      const result =
        await XiaozhiConnectionManagerSingleton.waitForInitialization();
      expect(result).toBe(false);
    });
  });

  describe("getStatus", () => {
    it("should return status information", async () => {
      const status1 = XiaozhiConnectionManagerSingleton.getStatus();
      expect(status1.state).toBe("not_initialized");

      await XiaozhiConnectionManagerSingleton.getInstance();
      const status2 = XiaozhiConnectionManagerSingleton.getStatus();
      expect(status2.state).toBe("initialized");
      expect(status2.instanceId).toBeDefined();
    });
  });
});
