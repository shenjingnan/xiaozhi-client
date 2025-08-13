import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock CLI to prevent process.exit
vi.mock("../cli.js", () => ({}));

// Mock all dependencies
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
    }),
  },
}));

vi.mock("../services/XiaozhiConnectionManagerSingleton.js", () => ({
  XiaozhiConnectionManagerSingleton: {
    getInstance: vi.fn().mockResolvedValue({
      initialize: vi.fn().mockResolvedValue(undefined),
      connect: vi.fn().mockResolvedValue(undefined),
      setServiceManager: vi.fn(),
      getHealthyConnections: vi.fn().mockReturnValue([]),
      getConnectionStatus: vi.fn().mockReturnValue([]),
      getLoadBalanceStats: vi.fn().mockReturnValue({}),
      getHealthCheckStats: vi.fn().mockReturnValue({}),
      getReconnectStats: vi.fn().mockReturnValue({}),
      selectBestConnection: vi.fn().mockReturnValue(null),
      on: vi.fn(),
    }),
    cleanup: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("WebServer Unit Tests", () => {
  let WebServer: any;
  let webServer: any;
  const mockPort = 3001;

  beforeEach(async () => {
    // 动态导入 WebServer
    const webServerModule = await import("../WebServer.js");
    WebServer = webServerModule.WebServer;

    vi.clearAllMocks();

    // 设置默认的 mock 返回值
    const { configManager } = await import("../configManager.js");
    vi.mocked(configManager.getConfig).mockReturnValue({
      port: mockPort,
      mcpEndpoint: ["wss://test1.example.com", "wss://test2.example.com"],
      mcpServers: [],
      enableCors: true,
      enableLogging: true,
    });

    vi.mocked(configManager.getMcpEndpoints).mockReturnValue([
      "wss://test1.example.com",
      "wss://test2.example.com",
    ]);

    vi.mocked(configManager.getMcpEndpoint).mockReturnValue(
      "wss://test1.example.com"
    );
    vi.mocked(configManager.getPort).mockReturnValue(mockPort);
    vi.mocked(configManager.getWebUIPort).mockReturnValue(mockPort);
    vi.mocked(configManager.configExists).mockReturnValue(true);
    vi.mocked(configManager.getServerConfigs).mockReturnValue([]);

    webServer = new WebServer(mockPort);
  });

  afterEach(async () => {
    if (webServer?.stop) {
      try {
        await webServer.stop();
      } catch (error) {
        // 忽略停止错误
      }
    }
  });

  describe("Connection Status API", () => {
    it("should provide connection status method", () => {
      expect(webServer.getXiaozhiConnectionStatus).toBeDefined();
      expect(typeof webServer.getXiaozhiConnectionStatus).toBe("function");
    });

    it("should return none status when no connections", () => {
      const connectionStatus = webServer.getXiaozhiConnectionStatus();

      expect(connectionStatus).toMatchObject({
        type: "none",
        connected: false,
      });
    });

    it("should handle multi-endpoint configuration", async () => {
      // Mock 成功的连接管理器
      const { XiaozhiConnectionManagerSingleton } = await import(
        "../services/XiaozhiConnectionManagerSingleton.js"
      );
      const mockManager = {
        initialize: vi.fn().mockResolvedValue(undefined),
        connect: vi.fn().mockResolvedValue(undefined),
        setServiceManager: vi.fn(),
        getHealthyConnections: vi.fn().mockReturnValue([{}, {}]),
        getConnectionStatus: vi.fn().mockReturnValue([{}, {}]),
        getLoadBalanceStats: vi
          .fn()
          .mockReturnValue({ strategy: "round-robin" }),
        getHealthCheckStats: vi.fn().mockReturnValue({ totalChecks: 10 }),
        getReconnectStats: vi.fn().mockReturnValue({ totalReconnects: 0 }),
        selectBestConnection: vi.fn().mockReturnValue({}),
        on: vi.fn(),
      };

      vi.mocked(
        XiaozhiConnectionManagerSingleton.getInstance
      ).mockResolvedValue(mockManager);

      // 模拟连接管理器已初始化
      webServer.xiaozhiConnectionManager = mockManager;

      const connectionStatus = webServer.getXiaozhiConnectionStatus();

      expect(connectionStatus).toMatchObject({
        type: "multi-endpoint",
        manager: {
          healthyConnections: 2,
          totalConnections: 2,
          loadBalanceStats: { strategy: "round-robin" },
          healthCheckStats: { totalChecks: 10 },
          reconnectStats: { totalReconnects: 0 },
        },
        connections: expect.any(Array),
      });
    });

    it("should handle single-endpoint fallback", async () => {
      // Mock ProxyMCPServer
      const { ProxyMCPServer } = await import("../ProxyMCPServer.js");
      const mockProxyServer = {
        endpoint: "wss://test.example.com",
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn(),
        setServiceManager: vi.fn(),
      };

      vi.mocked(ProxyMCPServer).mockReturnValue(mockProxyServer);

      // 模拟单连接模式
      webServer.proxyMCPServer = mockProxyServer;
      webServer.xiaozhiConnectionManager = undefined;

      const connectionStatus = webServer.getXiaozhiConnectionStatus();

      expect(connectionStatus).toMatchObject({
        type: "single-endpoint",
        connected: true,
        endpoint: "unknown",
      });
    });
  });

  describe("WebServer Constructor", () => {
    it("should create WebServer instance", () => {
      expect(webServer).toBeDefined();
      expect(webServer.getXiaozhiConnectionStatus).toBeDefined();
    });

    it("should handle custom port", () => {
      const customPort = 4000;
      const customWebServer = new WebServer(customPort);
      expect(customWebServer).toBeDefined();
    });
  });

  describe("Integration with Connection Manager", () => {
    it("should have getBestXiaozhiConnection method", () => {
      // 这个方法是私有的，但我们可以验证它存在
      expect(webServer.getBestXiaozhiConnection).toBeDefined();
    });
  });
});
