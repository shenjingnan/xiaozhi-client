import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { XiaozhiConnectionManager, type XiaozhiConnectionOptions } from "../XiaozhiConnectionManager.js";
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
vi.mock("../../logger.js", () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe("XiaozhiConnectionManager", () => {
  let manager: XiaozhiConnectionManager;
  const mockEndpoints = ["wss://test1.example.com", "wss://test2.example.com"];
  const mockTools = [
    { name: "test-tool", description: "Test tool", inputSchema: { type: "object", properties: {} } }
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
      await expect(manager.initialize([], mockTools)).rejects.toThrow("端点列表不能为空");
    });

    it("should throw error for invalid endpoint URL", async () => {
      await expect(manager.initialize(["invalid-url"], mockTools)).rejects.toThrow(
        "端点地址必须是 WebSocket URL"
      );
    });

    it("should throw error for non-WebSocket URL", async () => {
      await expect(manager.initialize(["http://example.com"], mockTools)).rejects.toThrow(
        "端点地址必须是 WebSocket URL"
      );
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
      await expect(manager.connect()).rejects.toThrow("XiaozhiConnectionManager 未初始化");
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
      await expect(manager.addEndpoint("wss://new.example.com")).rejects.toThrow(
        "XiaozhiConnectionManager 未初始化"
      );
    });

    it("should add new endpoint successfully", async () => {
      await manager.initialize(mockEndpoints, mockTools);
      
      const newEndpoint = "wss://new.example.com";
      await manager.addEndpoint(newEndpoint);
      
      const connectionStatus = manager.getConnectionStatus();
      expect(connectionStatus).toHaveLength(3);
      expect(connectionStatus.some(status => status.endpoint === newEndpoint)).toBe(true);
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
      
      const instance = await XiaozhiConnectionManagerSingleton.getInstance(options);
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
      const instance2 = await XiaozhiConnectionManagerSingleton.forceReinitialize();
      
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
      const result = await XiaozhiConnectionManagerSingleton.waitForInitialization();
      expect(result).toBe(true);
    });

    it("should return false when not initialized", async () => {
      const result = await XiaozhiConnectionManagerSingleton.waitForInitialization();
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
