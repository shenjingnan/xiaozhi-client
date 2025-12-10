import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock CLI to prevent process.exit
vi.mock("@cli.js", () => ({}));

// Mock all dependencies
vi.mock("../configManager.js", () => ({
  configManager: {
    getConfig: vi.fn(),
    getMcpEndpoints: vi.fn(),
    getMcpEndpoint: vi.fn(),
    getMcpServers: vi.fn(),
    updateMcpEndpoint: vi.fn(),
    getWebUIPort: vi.fn(),
    configExists: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    cleanupInvalidServerToolsConfig: vi.fn(),
  },
}));

vi.mock("@/lib/endpoint/connection.js", () => ({
  ProxyMCPServer: vi.fn().mockImplementation((endpoint: string) => ({
    endpoint,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    setServiceManager: vi.fn(),
  })),
}));

vi.mock("@services/MCPServiceManagerSingleton.js", () => ({
  MCPServiceManagerSingleton: {
    getInstance: vi.fn().mockResolvedValue({
      startAllServices: vi.fn().mockResolvedValue(undefined),
      getAllTools: vi.fn().mockReturnValue([]),
      cleanup: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock("@/lib/endpoint/index.js", () => ({
  IndependentXiaozhiConnectionManager: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn().mockResolvedValue(undefined),
    setServiceManager: vi.fn(),
    getConnectionStatus: vi.fn().mockReturnValue([]),
    on: vi.fn(),
    cleanup: vi.fn().mockResolvedValue(undefined),
  })),
}));
import { MCPServiceManagerSingleton } from "@services/MCPServiceManagerSingleton.js";

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
      mcpEndpoint: ["wss://test1.example.com", "wss://test2.example.com"],
      mcpServers: {},
      webUI: {
        port: mockPort,
      },
    });

    vi.mocked(configManager.getMcpEndpoints).mockReturnValue([
      "wss://test1.example.com",
      "wss://test2.example.com",
    ]);

    vi.mocked(configManager.getMcpEndpoint).mockReturnValue(
      "wss://test1.example.com"
    );
    vi.mocked(configManager.getWebUIPort).mockReturnValue(mockPort);
    vi.mocked(configManager.configExists).mockReturnValue(true);
    vi.mocked(configManager.getMcpServers).mockReturnValue({});

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
      // 创建一个 mock 连接管理器
      const mockManager = {
        getConnectionStatus: vi.fn().mockReturnValue([]),
        cleanup: vi.fn().mockResolvedValue(undefined),
      };
      webServer.setXiaozhiConnectionManager(mockManager);

      const connectionStatus = webServer.getXiaozhiConnectionStatus();

      expect(connectionStatus).toMatchObject({
        type: "multi-endpoint",
        manager: {
          connectedConnections: 0,
          totalConnections: 0,
          healthCheckStats: {},
        },
        connections: [],
      });
    });

    it("should handle multi-endpoint configuration", async () => {
      // Mock 成功的连接管理器
      const mockManager = {
        getConnectionStatus: vi.fn().mockReturnValue([
          { endpoint: "wss://test1.example.com", connected: true },
          { endpoint: "wss://test2.example.com", connected: true },
        ]),
        cleanup: vi.fn().mockResolvedValue(undefined),
      };

      // 使用依赖注入设置 mock 连接管理器
      webServer.setXiaozhiConnectionManager(mockManager);

      const connectionStatus = webServer.getXiaozhiConnectionStatus();

      expect(connectionStatus).toMatchObject({
        type: "multi-endpoint",
        manager: {
          connectedConnections: 2,
          totalConnections: 2,
          healthCheckStats: {},
        },
        connections: expect.any(Array),
      });
    });

    it("should handle single-endpoint fallback", async () => {
      // Mock ProxyMCPServer
      const mockProxyServer = {
        endpoint: "wss://test.example.com",
        isConnected: false,
        getStatus: vi.fn().mockReturnValue({
          connected: false,
          initialized: false,
          url: "wss://test.example.com",
          availableTools: 0,
          connectionState: "disconnected",
          reconnectAttempts: 0,
          lastError: null,
        }),
      } as any;

      // 设置 fallback 服务器
      webServer.proxyMCPServer = mockProxyServer;

      // 清空连接管理器（不设置，让它为 undefined）
      (webServer as any).xiaozhiConnectionManager = undefined;

      const connectionStatus = webServer.getXiaozhiConnectionStatus();

      expect(connectionStatus).toMatchObject({
        type: "single-endpoint",
        connected: true,  // 注意：proxyMCPServer 存在时总是返回 connected: true
        endpoint: "unknown",  // 注意：返回的是 "unknown"，不是实际 endpoint
      });
    });
  });

  describe("依赖注入功能", () => {
    it("应该允许设置连接管理器", () => {
      const mockManager = {
        initialize: vi.fn(),
        connect: vi.fn(),
      } as any;

      webServer.setXiaozhiConnectionManager(mockManager);

      expect(webServer.getXiaozhiConnectionManager()).toBe(mockManager);
    });

    it("应该在获取连接管理器时返回已设置的实例", () => {
      const mockManager = {
        test: "value",
      } as any;

      webServer.setXiaozhiConnectionManager(mockManager);

      const manager = webServer.getXiaozhiConnectionManager();
      expect(manager).toBe(mockManager);
      expect((manager as any).test).toBe("value");
    });
  });

  describe("初始化流程", () => {
    let mockConnectionManager: any;
    let mockServiceManager: any;

    beforeEach(() => {
      // Mock 连接管理器
      mockConnectionManager = {
        initialize: vi.fn().mockResolvedValue(undefined),
        connect: vi.fn().mockResolvedValue(undefined),
        setServiceManager: vi.fn(),
        getConnectionStatus: vi.fn().mockReturnValue([]),
        on: vi.fn(),
        cleanup: vi.fn().mockResolvedValue(undefined),
      };

      // Mock MCP 服务管理器
      mockServiceManager = {
        startAllServices: vi.fn().mockResolvedValue(undefined),
        getAllTools: vi.fn().mockReturnValue([]),
        cleanup: vi.fn().mockResolvedValue(undefined),
      };

      // 重置 MCP 服务管理器的 mock
      vi.mocked(MCPServiceManagerSingleton.getInstance).mockResolvedValue(
        mockServiceManager
      );
    });

    it("应该在有端点配置时正确初始化", async () => {
      // 使用依赖注入设置 mock 连接管理器
      webServer.setXiaozhiConnectionManager(mockConnectionManager);

      // 设置 mcpServiceManager
      webServer.mcpServiceManager = mockServiceManager;

      // 调用被测试的方法
      await (webServer as any).initializeXiaozhiConnection(
        "wss://test.example.com",
        []
      );

      // 验证服务管理器已设置
      expect(mockConnectionManager.setServiceManager).toHaveBeenCalledWith(
        mockServiceManager
      );

      // 验证连接管理器被初始化
      expect(mockConnectionManager.initialize).toHaveBeenCalledWith(
        ["wss://test.example.com"],
        []
      );
      expect(mockConnectionManager.connect).toHaveBeenCalled();
    });

    it("应该在空端点配置时正确初始化", async () => {
      // 使用依赖注入设置 mock 连接管理器
      webServer.setXiaozhiConnectionManager(mockConnectionManager);

      // 设置 mcpServiceManager
      webServer.mcpServiceManager = mockServiceManager;

      // 调用被测试的方法 - 空配置
      await (webServer as any).initializeXiaozhiConnection("", []);

      // 验证服务管理器已设置
      expect(mockConnectionManager.setServiceManager).toHaveBeenCalledWith(
        mockServiceManager
      );

      // 验证连接管理器被初始化为空管理器
      expect(mockConnectionManager.initialize).toHaveBeenCalledWith([], []);
      expect(mockConnectionManager.connect).not.toHaveBeenCalled();
    });

    it("应该在无效端点配置时正确初始化", async () => {
      // 使用依赖注入设置 mock 连接管理器
      webServer.setXiaozhiConnectionManager(mockConnectionManager);

      webServer.mcpServiceManager = mockServiceManager;

      // 调用被测试的方法 - 无效端点
      await (webServer as any).initializeXiaozhiConnection(
        ["<请填写小智接入点>", ""],
        []
      );

      // 验证服务管理器已设置
      expect(mockConnectionManager.setServiceManager).toHaveBeenCalledWith(
        mockServiceManager
      );

      // 验证连接管理器被初始化为空管理器
      expect(mockConnectionManager.initialize).toHaveBeenCalledWith([], []);
      expect(mockConnectionManager.connect).not.toHaveBeenCalled();
    });
  });

  describe("清理流程", () => {
    it("应该在停止时清理连接管理器", async () => {
      const mockManager = {
        cleanup: vi.fn().mockResolvedValue(undefined),
      } as any;

      // 使用依赖注入设置 mock 连接管理器
      webServer.setXiaozhiConnectionManager(mockManager);

      // 创建一个 mock HTTP 服务器
      const mockHttpServer = {
        close: vi.fn().mockImplementation((callback: () => void) => {
          callback();
        }),
        listening: true,
      };

      // 设置内部属性
      (webServer as any).httpServer = mockHttpServer;
      (webServer as any).wss = {
        clients: new Set(),
        close: vi.fn().mockImplementation((callback: () => void) => {
          callback();
        }),
      };

      // 调用 stop 方法
      await webServer.stop();

      // 验证清理被调用
      expect(mockManager.cleanup).toHaveBeenCalled();
    });

      });
});
