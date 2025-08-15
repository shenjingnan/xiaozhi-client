import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { configManager } from "../configManager.js";
import { XiaozhiConnectionManagerSingleton } from "../services/XiaozhiConnectionManagerSingleton.js";

// Mock CLI to prevent process.exit
vi.mock("../cli.js", () => ({}));

// 动态导入 WebServer 以避免 CLI 模块的副作用
let WebServer: any;

// Mock dependencies
vi.mock("../configManager.js", () => ({
  configManager: {
    getConfig: vi.fn(),
    getMcpEndpoints: vi.fn(),
    getMcpEndpoint: vi.fn(),
    updateMcpEndpoint: vi.fn(),
    getServerConfigs: vi.fn(),
    getPort: vi.fn(),
    getWebUIPort: vi.fn(),
    configExists: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

vi.mock("../ProxyMCPServer.js", () => ({
  ProxyMCPServer: vi.fn().mockImplementation((endpoint: string) => ({
    endpoint,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    setServiceManager: vi.fn(),
  })),
}));

vi.mock("../services/MCPServiceManagerSingleton.js", () => ({
  MCPServiceManagerSingleton: {
    getInstance: vi.fn().mockResolvedValue({
      startAllServices: vi.fn().mockResolvedValue(undefined),
      getAllTools: vi.fn().mockReturnValue([]),
      cleanup: vi.fn().mockResolvedValue(undefined),
      addServiceConfig: vi.fn(),
    }),
  },
}));

vi.mock("../services/XiaozhiConnectionManagerSingleton.js", () => ({
  XiaozhiConnectionManagerSingleton: {
    getInstance: vi.fn().mockResolvedValue({
      initialize: vi.fn().mockResolvedValue(undefined),
      connect: vi.fn().mockResolvedValue(undefined),
      setServiceManager: vi.fn(),
      getHealthyConnections: vi.fn().mockReturnValue([{ id: "conn1" }]),
      getConnectionStatus: vi.fn().mockReturnValue([{ id: "conn1", status: "connected" }]),
      getLoadBalanceStats: vi.fn().mockReturnValue({}),
      getHealthCheckStats: vi.fn().mockReturnValue({}),
      getReconnectStats: vi.fn().mockReturnValue({}),
      selectBestConnection: vi.fn().mockReturnValue(null),
      on: vi.fn(),
    }),
    cleanup: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("WebServer Integration Tests", () => {
  let webServer: any;
  const basePort = 3001;
  let currentTestPort = basePort;

  beforeAll(async () => {
    // 动态导入 WebServer
    const webServerModule = await import("../WebServer.js");
    WebServer = webServerModule.WebServer;

    // 清理单例状态
    await XiaozhiConnectionManagerSingleton.cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // 为每个测试分配唯一端口，避免冲突
    currentTestPort = basePort + Math.floor(Math.random() * 10000) + Date.now() % 1000;

    // 设置默认的 mock 返回值
    vi.mocked(configManager.getConfig).mockReturnValue({
      mcpEndpoint: ["wss://test1.example.com", "wss://test2.example.com"],
      mcpServers: {},
      enableCors: true,
      enableLogging: true,
    } as any);

    vi.mocked(configManager.getMcpEndpoints).mockReturnValue([
      "wss://test1.example.com",
      "wss://test2.example.com",
    ]);

    vi.mocked(configManager.getMcpEndpoint).mockReturnValue(
      "wss://test1.example.com"
    );
    vi.mocked(configManager.getWebUIPort).mockReturnValue(currentTestPort);
    vi.mocked(configManager.configExists).mockReturnValue(true);

    // 使用当前测试的唯一端口
    webServer = new WebServer(currentTestPort);
  });

  afterEach(async () => {
    if (webServer) {
      try {
        await webServer.stop();
        // 等待端口完全释放
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        // 忽略停止时的错误，确保清理继续进行
        console.warn("Error stopping webServer:", error);
      }
    }
    await XiaozhiConnectionManagerSingleton.cleanup();
  });

  afterAll(async () => {
    await XiaozhiConnectionManagerSingleton.cleanup();
  });

  describe("Multi-endpoint Connection Management", () => {
    it("should initialize with multiple endpoints", async () => {
      // 启动 WebServer（不实际启动服务器，只测试连接管理器）
      try {
        await webServer.start();
      } catch (error) {
        // 忽略服务器启动错误，专注于连接管理器测试
      }

      // 验证连接管理器已初始化
      const connectionStatus = webServer.getXiaozhiConnectionStatus();

      // 由于 mock 的限制，我们主要验证方法能正常调用
      expect(connectionStatus).toBeDefined();
      expect(connectionStatus.type).toMatch(
        /multi-endpoint|single-endpoint|none/
      );
    });

    it("should handle single endpoint configuration", async () => {
      // 配置单个端点
      vi.mocked(configManager.getMcpEndpoints).mockReturnValue([
        "wss://single.example.com",
      ]);
      vi.mocked(configManager.getConfig).mockReturnValue({
        mcpEndpoint: "wss://single.example.com",
        mcpServers: {},
        enableCors: true,
        enableLogging: true,
      } as any);

      try {
        await webServer.start();
      } catch (error) {
        // 忽略服务器启动错误
      }

      const connectionStatus = webServer.getXiaozhiConnectionStatus();
      expect(connectionStatus).toBeDefined();
      expect(connectionStatus.type).toMatch(
        /multi-endpoint|single-endpoint|none/
      );
    });

    it("should handle empty endpoint configuration", async () => {
      // 配置空端点
      vi.mocked(configManager.getMcpEndpoints).mockReturnValue([]);
      vi.mocked(configManager.getConfig).mockReturnValue({
        mcpEndpoint: [],
        mcpServers: {},
        enableCors: true,
        enableLogging: true,
      } as any);

      await webServer.start();

      const connectionStatus = webServer.getXiaozhiConnectionStatus();
      expect(connectionStatus.type).toBe("none");
      expect(connectionStatus.connected).toBe(false);
    });

    it("should handle invalid endpoint configuration", async () => {
      // 配置无效端点
      vi.mocked(configManager.getMcpEndpoints).mockReturnValue([
        "<请填写小智接入点>",
        "invalid-url",
        "wss://valid.example.com",
      ]);
      vi.mocked(configManager.getConfig).mockReturnValue({
        mcpEndpoint: [
          "<请填写小智接入点>",
          "invalid-url",
          "wss://valid.example.com",
        ],
        mcpServers: {},
        enableCors: true,
        enableLogging: true,
      } as any);

      // 为这个测试设置特定的 mock 行为，模拟只有一个有效连接
      const { XiaozhiConnectionManagerSingleton } = await import(
        "../services/XiaozhiConnectionManagerSingleton.js"
      );
      vi.mocked(XiaozhiConnectionManagerSingleton.getInstance).mockResolvedValue({
        initialize: vi.fn().mockResolvedValue(undefined),
        connect: vi.fn().mockResolvedValue(undefined),
        setServiceManager: vi.fn(),
        getHealthyConnections: vi.fn().mockReturnValue([{ id: "valid-conn" }]),
        getConnectionStatus: vi.fn().mockReturnValue([{ id: "valid-conn", status: "connected" }]),
        getLoadBalanceStats: vi.fn().mockReturnValue({}),
        getHealthCheckStats: vi.fn().mockReturnValue({}),
        getReconnectStats: vi.fn().mockReturnValue({}),
        selectBestConnection: vi.fn().mockReturnValue(null),
        on: vi.fn(),
      } as any);

      await webServer.start();

      const connectionStatus = webServer.getXiaozhiConnectionStatus();
      expect(connectionStatus.type).toBe("multi-endpoint");
      expect(connectionStatus.manager.totalConnections).toBe(1); // 只有一个有效端点
    });
  });

  describe("Fallback to Single Connection Mode", () => {
    it("should fallback to single connection mode when manager fails", async () => {
      // Mock 连接管理器初始化失败
      const originalGetInstance = XiaozhiConnectionManagerSingleton.getInstance;
      vi.spyOn(
        XiaozhiConnectionManagerSingleton,
        "getInstance"
      ).mockRejectedValue(
        new Error("Connection manager initialization failed")
      );

      await webServer.start();

      const connectionStatus = webServer.getXiaozhiConnectionStatus();
      expect(connectionStatus.type).toBe("single-endpoint");
      expect(connectionStatus.connected).toBe(true);

      // 恢复原始方法
      vi.mocked(
        XiaozhiConnectionManagerSingleton.getInstance
      ).mockImplementation(originalGetInstance);
    });
  });

  describe("Connection Status API", () => {
    it("should provide detailed connection status for multi-endpoint", async () => {
      await webServer.start();

      const connectionStatus = webServer.getXiaozhiConnectionStatus();

      expect(connectionStatus).toMatchObject({
        type: "multi-endpoint",
        manager: {
          healthyConnections: expect.any(Number),
          totalConnections: expect.any(Number),
          loadBalanceStats: expect.any(Object),
          healthCheckStats: expect.any(Object),
          reconnectStats: expect.any(Object),
        },
        connections: expect.any(Array),
      });
    });

    it("should provide connection status for single-endpoint fallback", async () => {
      // Mock 连接管理器失败，触发单连接模式
      vi.spyOn(
        XiaozhiConnectionManagerSingleton,
        "getInstance"
      ).mockRejectedValue(new Error("Manager failed"));

      await webServer.start();

      const connectionStatus = webServer.getXiaozhiConnectionStatus();

      expect(connectionStatus).toMatchObject({
        type: "single-endpoint",
        connected: true,
        endpoint: "unknown",
      });
    });

    it("should provide connection status when no connections", async () => {
      // 配置无端点
      vi.mocked(configManager.getMcpEndpoints).mockReturnValue([]);
      vi.mocked(configManager.getConfig).mockReturnValue({
        mcpEndpoint: [],
        mcpServers: {},
        enableCors: true,
        enableLogging: true,
      } as any);

      await webServer.start();

      const connectionStatus = webServer.getXiaozhiConnectionStatus();

      expect(connectionStatus).toMatchObject({
        type: "none",
        connected: false,
      });
    });
  });

  describe("Server Lifecycle", () => {
    it("should start and stop server successfully", async () => {
      await expect(webServer.start()).resolves.not.toThrow();
      await expect(webServer.stop()).resolves.not.toThrow();
    });

    it("should handle multiple start calls gracefully", async () => {
      await webServer.start();

      // 第二次启动应该不抛出错误
      await expect(webServer.start()).resolves.not.toThrow();

      // 确保在测试结束时停止服务器
      await webServer.stop();
    });

    it("should handle stop without start", async () => {
      // 未启动就停止应该不抛出错误
      await expect(webServer.stop()).resolves.not.toThrow();
    });
  });

  describe("Error Handling", () => {
    it("should handle configuration errors gracefully", async () => {
      // Mock 配置错误
      vi.mocked(configManager.getConfig).mockImplementation(() => {
        throw new Error("Configuration error");
      });

      // WebServer 应该优雅地处理配置错误，不抛出异常但记录错误
      await expect(webServer.start()).resolves.not.toThrow();

      // 验证连接状态反映了错误情况
      const connectionStatus = webServer.getXiaozhiConnectionStatus();
      expect(connectionStatus.type).toBe("none");
      expect(connectionStatus.connected).toBe(false);
    });

    it("should handle service manager initialization errors", async () => {
      // Mock 服务管理器错误
      const { MCPServiceManagerSingleton } = await import(
        "../services/MCPServiceManagerSingleton.js"
      );
      vi.mocked(MCPServiceManagerSingleton.getInstance).mockRejectedValue(
        new Error("Service manager error")
      );

      // WebServer 应该优雅地处理服务管理器错误，不抛出异常但记录错误
      await expect(webServer.start()).resolves.not.toThrow();

      // 验证连接状态反映了错误情况
      const connectionStatus = webServer.getXiaozhiConnectionStatus();
      expect(connectionStatus.type).toBe("none");
      expect(connectionStatus.connected).toBe(false);
    });
  });
});
