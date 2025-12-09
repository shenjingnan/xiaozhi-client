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

import { ProxyMCPServer } from "@/lib/endpoint/connection.js";
// Import the mocked modules for use in tests
import { MCPServiceManagerSingleton } from "@services/MCPServiceManagerSingleton.js";
import { XiaozhiConnectionManagerSingleton } from "@services/XiaozhiConnectionManagerSingleton.js";

vi.mock("@services/XiaozhiConnectionManagerSingleton.js", () => ({
  XiaozhiConnectionManagerSingleton: {
    getInstance: vi.fn().mockResolvedValue({
      initialize: vi.fn().mockResolvedValue(undefined),
      connect: vi.fn().mockResolvedValue(undefined),
      setServiceManager: vi.fn(),
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
      const connectionStatus = webServer.getXiaozhiConnectionStatus();

      expect(connectionStatus).toMatchObject({
        type: "none",
        connected: false,
      });
    });

    it("should handle multi-endpoint configuration", async () => {
      // Mock 成功的连接管理器
      const { XiaozhiConnectionManagerSingleton } = await import(
        "@services/XiaozhiConnectionManagerSingleton.js"
      );
      const mockManager = {
        // 基本属性
        connections: new Map(),
        connectionStates: new Map(),
        mcpServiceManager: null,
        logger: vi.fn(),

        // 状态属性
        isInitialized: true,
        isConnecting: false,
        options: {},
        healthCheckInterval: null,
        reconnectTimers: new Map(),
        roundRobinIndex: 0,
        lastSelectedEndpoint: null,

        // 方法
        initialize: vi.fn().mockResolvedValue(undefined),
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        setServiceManager: vi.fn(),
        getConnectionStatus: vi
          .fn()
          .mockReturnValue([{ connected: true }, { connected: true }]),
        getLoadBalanceStats: vi
          .fn()
          .mockReturnValue({ strategy: "round-robin" }),
        getHealthCheckStats: vi.fn().mockReturnValue({ totalChecks: 10 }),
        getReconnectStats: vi.fn().mockReturnValue({ totalReconnects: 0 }),
        selectBestConnection: vi.fn().mockReturnValue({}),
        updateEndpoints: vi.fn().mockResolvedValue(undefined),
        updateOptions: vi.fn(),
        getCurrentConfig: vi
          .fn()
          .mockReturnValue({ endpoints: [], options: {} }),
        reloadConfig: vi.fn().mockResolvedValue(undefined),
        cleanup: vi.fn().mockResolvedValue(undefined),
        optimizeMemoryUsage: vi.fn(),

        // EventEmitter 方法
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        removeAllListeners: vi.fn(),
        setMaxListeners: vi.fn(),
        getMaxListeners: vi.fn(),
        listeners: vi.fn(),
        rawListeners: vi.fn(),
        listenerCount: vi.fn(),
        prependListener: vi.fn(),
        prependOnceListener: vi.fn(),
        eventNames: vi.fn(),
        once: vi.fn(),
      } as any;

      vi.mocked(
        XiaozhiConnectionManagerSingleton.getInstance
      ).mockResolvedValue(mockManager);

      // 模拟连接管理器已初始化
      webServer.xiaozhiConnectionManager = mockManager;

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
      const { ProxyMCPServer } = await import("@/lib/endpoint/index.js");
      const mockProxyServer = {
        // 基本属性
        endpointUrl: "wss://test.example.com",
        ws: null,
        logger: vi.fn(),
        isConnected: false,
        serverInitialized: false,
        tools: new Map(),
        connectionState: "disconnected",
        reconnectOptions: {},
        reconnectState: {},
        connectionTimeout: null,
        callRecords: [],
        maxCallRecords: 100,
        retryConfig: {},
        toolCallConfig: {},

        // 方法
        endpoint: "wss://test.example.com",
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn(),
        setServiceManager: vi.fn(),
        syncToolsFromServiceManager: vi.fn(),
        addTool: vi.fn(),
        removeTool: vi.fn(),
        getTools: vi.fn().mockReturnValue([]),
        getStatus: vi.fn().mockReturnValue({
          connected: false,
          initialized: false,
          url: "wss://test.example.com",
          availableTools: 0,
          connectionState: "disconnected",
          reconnectAttempts: 0,
          lastError: null,
        }),
        reconnect: vi.fn().mockResolvedValue(undefined),
        enableReconnect: vi.fn(),
        disableReconnect: vi.fn(),
        updateReconnectOptions: vi.fn(),
        getReconnectOptions: vi.fn().mockReturnValue({}),
        resetReconnectState: vi.fn(),
        updateToolCallConfig: vi.fn(),
        updateRetryConfig: vi.fn(),
        getConfiguration: vi.fn().mockReturnValue({}),
      } as any;

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

  describe("initializeXiaozhiConnection 方法", () => {
    let mockConnectionManager: any;
    let mockServiceManager: any;

    beforeEach(() => {
      // 创建完整的 mock 连接管理器
      mockConnectionManager = {
        initialize: vi.fn().mockResolvedValue(undefined),
        connect: vi.fn().mockResolvedValue(undefined),
        setServiceManager: vi.fn(),
        getConnectionStatus: vi.fn().mockReturnValue([]),
        getReconnectStats: vi.fn().mockReturnValue({}),
        on: vi.fn(),
        isInitialized: true,
      };

      mockServiceManager = {
        getAllTools: vi.fn().mockReturnValue([
          { name: "test-tool1", description: "Test tool 1" },
          { name: "test-tool2", description: "Test tool 2" },
        ]),
      };

      // 重置 MCP 服务管理器的 mock
      vi.mocked(MCPServiceManagerSingleton.getInstance).mockResolvedValue(
        mockServiceManager
      );
    });

    describe("空配置场景测试", () => {
      it("应该在空端点配置时始终初始化连接管理器", async () => {
        // Mock 连接管理器单例
        vi.mocked(
          XiaozhiConnectionManagerSingleton.getInstance
        ).mockResolvedValue(mockConnectionManager);

        // 设置 mcpServiceManager
        webServer.mcpServiceManager = mockServiceManager;

        // 调用被测试的方法 - 空配置
        await (webServer as any).initializeXiaozhiConnection("", []);

        // 验证连接管理器被初始化
        expect(
          XiaozhiConnectionManagerSingleton.getInstance
        ).toHaveBeenCalledWith({
          connectionTimeout: 10000,
        });

        // 验证连接管理器已设置
        expect(webServer.xiaozhiConnectionManager).toBeDefined();
        expect(webServer.xiaozhiConnectionManager).toBe(mockConnectionManager);

        // 验证设置了服务管理器
        expect(mockConnectionManager.setServiceManager).toHaveBeenCalledWith(
          mockServiceManager
        );

        // 验证连接管理器被初始化为空管理器（修复后应该调用 initialize）
        expect(mockConnectionManager.initialize).toHaveBeenCalledWith([], []);
        expect(mockConnectionManager.connect).not.toHaveBeenCalled();
      });

      it("应该在无效端点配置时始终初始化连接管理器", async () => {
        vi.mocked(
          XiaozhiConnectionManagerSingleton.getInstance
        ).mockResolvedValue(mockConnectionManager);

        webServer.mcpServiceManager = mockServiceManager;

        // 调用被测试的方法 - 无效端点
        await (webServer as any).initializeXiaozhiConnection(
          ["<请填写小智接入点>", ""],
          []
        );

        // 验证连接管理器仍然被初始化
        expect(
          XiaozhiConnectionManagerSingleton.getInstance
        ).toHaveBeenCalled();
        expect(webServer.xiaozhiConnectionManager).toBeDefined();

        // 验证连接管理器被初始化为空管理器（修复后应该调用 initialize）
        expect(mockConnectionManager.initialize).toHaveBeenCalledWith([], []);
        expect(mockConnectionManager.connect).not.toHaveBeenCalled();
      });

      it("应该在连接管理器初始化失败时继续执行", async () => {
        const error = new Error("Connection manager initialization failed");
        vi.mocked(
          XiaozhiConnectionManagerSingleton.getInstance
        ).mockRejectedValue(error);

        webServer.mcpServiceManager = mockServiceManager;

        // 调用被测试的方法 - 不应该抛出异常
        await expect(
          (webServer as any).initializeXiaozhiConnection("", [])
        ).resolves.not.toThrow();

        // 验证连接管理器仍然为 undefined
        expect(webServer.xiaozhiConnectionManager).toBeUndefined();
      });
    });

    describe("单端点配置测试", () => {
      it("应该在有效单端点时初始化并连接", async () => {
        vi.mocked(
          XiaozhiConnectionManagerSingleton.getInstance
        ).mockResolvedValue(mockConnectionManager);

        webServer.mcpServiceManager = mockServiceManager;

        const tools = [{ name: "test-tool", description: "Test tool" }];
        const endpoint = "ws://localhost:8080";

        // 调用被测试的方法
        await (webServer as any).initializeXiaozhiConnection(endpoint, tools);

        // 验证连接管理器被初始化
        expect(
          XiaozhiConnectionManagerSingleton.getInstance
        ).toHaveBeenCalledWith({
          connectionTimeout: 10000,
        });

        // 验证设置了服务管理器
        expect(mockConnectionManager.setServiceManager).toHaveBeenCalledWith(
          mockServiceManager
        );

        // 验证连接管理器被初始化和连接
        expect(mockConnectionManager.initialize).toHaveBeenCalledWith(
          [endpoint],
          tools
        );
        expect(mockConnectionManager.connect).toHaveBeenCalled();

        // 验证配置变更监听器被设置
        expect(mockConnectionManager.on).toHaveBeenCalledWith(
          "configChange",
          expect.any(Function)
        );
      });
    });

    describe("多端点配置测试", () => {
      it("应该在多个有效端点时正确处理", async () => {
        vi.mocked(
          XiaozhiConnectionManagerSingleton.getInstance
        ).mockResolvedValue(mockConnectionManager);

        webServer.mcpServiceManager = mockServiceManager;

        const tools = [{ name: "test-tool", description: "Test tool" }];
        const endpoints = [
          "ws://localhost:8080",
          "wss://secure.example.com",
          "ws://192.168.1.100:3000",
        ];

        // 调用被测试的方法
        await (webServer as any).initializeXiaozhiConnection(endpoints, tools);

        // 验证连接管理器被初始化
        expect(
          XiaozhiConnectionManagerSingleton.getInstance
        ).toHaveBeenCalled();

        // 验证所有端点都被传递给连接管理器
        expect(mockConnectionManager.initialize).toHaveBeenCalledWith(
          endpoints,
          tools
        );
        expect(mockConnectionManager.connect).toHaveBeenCalled();

        // 验证设置了服务管理器
        expect(mockConnectionManager.setServiceManager).toHaveBeenCalledWith(
          mockServiceManager
        );
      });
    });

    describe("混合端点测试", () => {
      it("应该过滤掉无效端点只连接有效端点", async () => {
        vi.mocked(
          XiaozhiConnectionManagerSingleton.getInstance
        ).mockResolvedValue(mockConnectionManager);

        webServer.mcpServiceManager = mockServiceManager;

        const tools = [{ name: "test-tool", description: "Test tool" }];
        const endpoints = [
          "<请填写小智接入点>", // 无效
          "", // 无效
          "ws://valid.example.com", // 有效
          "wss://secure.example.com", // 有效
          "invalid-url", // 有效（不会被过滤，因为只过滤包含 <请填写 的端点）
        ];

        const expectedValidEndpoints = [
          "ws://valid.example.com",
          "wss://secure.example.com",
          "invalid-url",
        ];

        // 调用被测试的方法
        await (webServer as any).initializeXiaozhiConnection(endpoints, tools);

        // 验证只传递有效端点
        expect(mockConnectionManager.initialize).toHaveBeenCalledWith(
          expectedValidEndpoints,
          tools
        );
        expect(mockConnectionManager.connect).toHaveBeenCalled();
      });

      it("应该在所有端点都无效时只初始化不连接", async () => {
        vi.mocked(
          XiaozhiConnectionManagerSingleton.getInstance
        ).mockResolvedValue(mockConnectionManager);

        webServer.mcpServiceManager = mockServiceManager;

        const tools = [{ name: "test-tool", description: "Test tool" }];
        const endpoints = ["<请填写小智接入点>", ""];

        // 调用被测试的方法
        await (webServer as any).initializeXiaozhiConnection(endpoints, tools);

        // 验证连接管理器被初始化
        expect(
          XiaozhiConnectionManagerSingleton.getInstance
        ).toHaveBeenCalled();
        expect(webServer.xiaozhiConnectionManager).toBeDefined();

        // 验证连接管理器被初始化为空管理器（修复后应该调用 initialize）
        expect(mockConnectionManager.initialize).toHaveBeenCalledWith(
          [],
          tools
        );
        expect(mockConnectionManager.connect).not.toHaveBeenCalled();
      });
    });

    describe("异常回退测试", () => {
      it("应该在连接管理器连接失败时回退到单连接模式", async () => {
        // Mock 连接管理器初始化成功但连接失败
        vi.mocked(
          XiaozhiConnectionManagerSingleton.getInstance
        ).mockResolvedValue(mockConnectionManager);

        // 模拟连接失败
        mockConnectionManager.initialize.mockRejectedValue(
          new Error("Connection failed")
        );

        // Mock ProxyMCPServer
        const mockProxyServer = {
          connect: vi.fn().mockResolvedValue(undefined),
          setServiceManager: vi.fn(),
        };
        vi.mocked(ProxyMCPServer).mockImplementation(
          () => mockProxyServer as any
        );

        // 重要：在调用前 mock connectWithRetry 方法避免真实等待
        vi.spyOn(webServer as any, "connectWithRetry").mockResolvedValue(
          undefined
        );

        webServer.mcpServiceManager = mockServiceManager;

        const tools = [{ name: "test-tool", description: "Test tool" }];
        const endpoint = "ws://localhost:8080";

        // 调用被测试的方法
        await (webServer as any).initializeXiaozhiConnection(endpoint, tools);

        // 验证尝试了连接管理器初始化
        expect(
          XiaozhiConnectionManagerSingleton.getInstance
        ).toHaveBeenCalled();

        // 验证回退到单连接模式
        expect(ProxyMCPServer).toHaveBeenCalledWith(endpoint);
        expect(mockProxyServer.setServiceManager).toHaveBeenCalledWith(
          mockServiceManager
        );

        // 验证 connectWithRetry 被调用
        expect((webServer as any).connectWithRetry).toHaveBeenCalled();

        // 验证 proxyMCPServer 被设置
        expect(webServer.proxyMCPServer).toBeDefined();
      });

      it("应该在单连接模式连接失败时抛出异常", async () => {
        // Mock 连接管理器失败
        vi.mocked(
          XiaozhiConnectionManagerSingleton.getInstance
        ).mockResolvedValue(mockConnectionManager);
        mockConnectionManager.initialize.mockRejectedValue(
          new Error("Connection manager failed")
        );

        // Mock ProxyMCPServer 也失败
        const mockProxyServer = {
          connect: vi
            .fn()
            .mockRejectedValue(new Error("Proxy connection failed")),
          setServiceManager: vi.fn(),
        };
        vi.mocked(ProxyMCPServer).mockImplementation(
          () => mockProxyServer as any
        );

        webServer.mcpServiceManager = mockServiceManager;

        const tools = [{ name: "test-tool", description: "Test tool" }];
        const endpoint = "ws://localhost:8080";

        // Mock connectWithRetry 方法避免真实等待
        vi.spyOn(webServer as any, "connectWithRetry").mockRejectedValue(
          new Error(
            "小智接入点连接 - 连接失败，已达到最大重试次数: Proxy connection failed"
          )
        );

        // 调用被测试的方法 - 应该抛出异常
        await expect(
          (webServer as any).initializeXiaozhiConnection(endpoint, tools)
        ).rejects.toThrow();

        // 验证尝试了两种连接方式（按执行顺序）
        expect(mockConnectionManager.initialize).toHaveBeenCalled();

        // 先验证 ProxyMCPServer 构造函数被调用
        expect(ProxyMCPServer).toHaveBeenCalledWith(endpoint);
        expect(mockProxyServer.setServiceManager).toHaveBeenCalledWith(
          mockServiceManager
        );

        // 再验证 connectWithRetry 被调用
        expect((webServer as any).connectWithRetry).toHaveBeenCalled();
      }, 10000); // 设置 10 秒超时
    });

    describe("边界条件测试", () => {
      it("应该处理 null/undefined 端点配置", async () => {
        vi.mocked(
          XiaozhiConnectionManagerSingleton.getInstance
        ).mockResolvedValue(mockConnectionManager);

        webServer.mcpServiceManager = mockServiceManager;

        // 测试 null
        await (webServer as any).initializeXiaozhiConnection(null as any, []);
        expect(
          XiaozhiConnectionManagerSingleton.getInstance
        ).toHaveBeenCalled();

        // 重置 mock
        vi.clearAllMocks();
        vi.mocked(
          XiaozhiConnectionManagerSingleton.getInstance
        ).mockResolvedValue(mockConnectionManager);

        // 测试 undefined
        await (webServer as any).initializeXiaozhiConnection(
          undefined as any,
          []
        );
        expect(
          XiaozhiConnectionManagerSingleton.getInstance
        ).toHaveBeenCalled();
      });

      it("应该处理空数组端点配置", async () => {
        vi.mocked(
          XiaozhiConnectionManagerSingleton.getInstance
        ).mockResolvedValue(mockConnectionManager);

        webServer.mcpServiceManager = mockServiceManager;

        await (webServer as any).initializeXiaozhiConnection([], []);

        // 验证连接管理器仍然被初始化
        expect(
          XiaozhiConnectionManagerSingleton.getInstance
        ).toHaveBeenCalled();
        expect(webServer.xiaozhiConnectionManager).toBeDefined();

        // 验证连接管理器被初始化为空管理器（修复后应该调用 initialize）
        expect(mockConnectionManager.initialize).toHaveBeenCalledWith([], []);
        expect(mockConnectionManager.connect).not.toHaveBeenCalled();
      });

      it("应该处理 mcpServiceManager 为 undefined 的情况", async () => {
        vi.mocked(
          XiaozhiConnectionManagerSingleton.getInstance
        ).mockResolvedValue(mockConnectionManager);

        // 不设置 mcpServiceManager

        await (webServer as any).initializeXiaozhiConnection(
          "ws://localhost:8080",
          []
        );

        // 验证连接管理器仍然被初始化
        expect(
          XiaozhiConnectionManagerSingleton.getInstance
        ).toHaveBeenCalled();

        // 验证没有调用 setServiceManager
        expect(mockConnectionManager.setServiceManager).not.toHaveBeenCalled();
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
});
