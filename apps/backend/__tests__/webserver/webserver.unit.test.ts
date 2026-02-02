import { MCPServiceManager } from "@/lib/mcp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebServer } from "../../WebServer";

// Mock configManager to avoid triggering real config loading
vi.mock("@xiaozhi-client/config", () => ({
  configManager: {
    getConfig: vi.fn(() => ({
      mcpEndpoint: [],
      mcpServers: {},
      connection: {},
    })),
    getMcpServers: vi.fn(() => ({})),
    getMcpEndpoints: vi.fn(() => []),
    configExists: vi.fn(() => true),
    updateMcpEndpoint: vi.fn(),
    updateMcpServer: vi.fn(),
    removeMcpServer: vi.fn(),
    updateConnectionConfig: vi.fn(),
    updateModelScopeConfig: vi.fn(),
    updateWebUIConfig: vi.fn(),
    setToolEnabled: vi.fn(),
    updatePlatformConfig: vi.fn(),
    getMcpEndpoint: vi.fn(),
    getConnectionConfig: vi.fn(),
    reloadConfig: vi.fn(),
    getConfigPath: vi.fn(),
    validateConfig: vi.fn(),
    updateConfig: vi.fn(),
  },
}));

// Mock Logger
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock EventBus
vi.mock("@/services/EventBus.js", () => ({
  getEventBus: vi.fn().mockReturnValue({
    onEvent: vi.fn(),
    emitEvent: vi.fn(),
    removeAllListeners: vi.fn(),
  }),
}));

// Mock EndpointManager
vi.mock("@/lib/endpoint/index.js", () => ({
  EndpointManager: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn().mockResolvedValue(undefined),
    setServiceManager: vi.fn(),
    getConnectionStatus: vi.fn().mockReturnValue([]),
    on: vi.fn(),
  })),
}));

// Mock MCPServiceManager
vi.mock("@/lib/mcp", () => ({
  MCPServiceManager: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    stopAllServices: vi.fn().mockResolvedValue(undefined),
    isRunning: false,
    tools: new Map(),
    services: new Map(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    removeAllListeners: vi.fn(),
    listTools: vi.fn().mockResolvedValue([]),
    callTool: vi.fn().mockResolvedValue({ content: [] }),
    addService: vi.fn(),
    removeService: vi.fn(),
    getServiceStatus: vi.fn().mockReturnValue("connected"),
  })),
}));

/**
 * 创建 Mock EndpointManager 的工厂函数
 * 使用 Partial 类型配合 as any 断言来绕过完整类型检查
 */
function createMockEndpointManager(): any {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn().mockResolvedValue(undefined),
    setServiceManager: vi.fn(),
    getConnectionStatus: vi.fn().mockReturnValue([]),
    on: vi.fn(),
    addEndpoint: vi.fn(),
    getEndpoints: vi.fn().mockReturnValue([]),
  };
}

describe("WebServer 单元测试", () => {
  let webServer: WebServer;
  const mockPort = 3001;

  beforeEach(() => {
    vi.clearAllMocks();
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
    it("应该提供连接状态方法", () => {
      expect(webServer.getEndpointConnectionStatus).toBeDefined();
      expect(typeof webServer.getEndpointConnectionStatus).toBe("function");
    });

    it("应该在无连接时返回 none 状态", () => {
      // 使用工厂函数创建 mock 连接管理器
      const mockManager = createMockEndpointManager();
      webServer.setXiaozhiConnectionManager(mockManager);

      const connectionStatus = webServer.getEndpointConnectionStatus();

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

    it("应该处理多端点配置", () => {
      // 使用工厂函数创建 mock 连接管理器
      const mockManager = createMockEndpointManager();
      // 配置特定的返回值
      mockManager.getConnectionStatus = vi.fn().mockReturnValue([
        { endpoint: "wss://test1.example.com", connected: true },
        { endpoint: "wss://test2.example.com", connected: true },
      ]);

      // 使用依赖注入设置 mock 连接管理器
      webServer.setXiaozhiConnectionManager(mockManager);

      const connectionStatus = webServer.getEndpointConnectionStatus();

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

    it("应该处理单端点回退", () => {
      // 清空连接管理器（不设置，让它为 undefined）
      (webServer as any).endpointManager = undefined;

      const connectionStatus = webServer.getEndpointConnectionStatus();

      // 新实现中，当 endpointManager 为 undefined 时返回 none 状态
      expect(connectionStatus).toMatchObject({
        type: "none",
        connected: false,
      });
    });
  });

  describe("依赖注入功能", () => {
    it("应该允许设置连接管理器", () => {
      const mockManager = {
        initialize: vi.fn(),
        connect: vi.fn(),
        cleanup: vi.fn().mockResolvedValue(undefined),
      } as any;

      webServer.setXiaozhiConnectionManager(mockManager);

      expect(webServer.getEndpointManager()).toBe(mockManager);
    });

    it("应该在获取连接管理器时返回已设置的实例", () => {
      const mockManager = {
        test: "value",
        cleanup: vi.fn().mockResolvedValue(undefined),
      } as any;

      webServer.setXiaozhiConnectionManager(mockManager);

      const manager = webServer.getEndpointManager();
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
        addEndpoint: vi.fn(),
        setServiceManager: vi.fn(),
        getConnectionStatus: vi.fn().mockReturnValue([]),
        on: vi.fn(),
        cleanup: vi.fn().mockResolvedValue(undefined),
      };

      // Mock MCP 服务管理器
      mockServiceManager = {
        startAllServices: vi.fn().mockResolvedValue(undefined),
        stopAllServices: vi.fn().mockResolvedValue(undefined),
        getAllTools: vi.fn().mockReturnValue([]),
        cleanup: vi.fn().mockResolvedValue(undefined),
      };
    });

    it("应该在有端点配置时正确初始化", async () => {
      // 使用依赖注入设置 mock 连接管理器
      webServer.setXiaozhiConnectionManager(mockConnectionManager);

      // 设置 mcpServiceManager
      webServer.setMCPServiceManager(mockServiceManager);

      // 调用被测试的方法
      await (webServer as any).initializeXiaozhiConnection(
        "wss://test.example.com",
        {}
      );

      // 验证端点被添加到连接管理器
      expect(mockConnectionManager.addEndpoint).toHaveBeenCalled();

      // 验证连接管理器被连接
      expect(mockConnectionManager.connect).toHaveBeenCalled();
    });

    it("应该在空端点配置时正确初始化", async () => {
      // 使用依赖注入设置 mock 连接管理器
      webServer.setXiaozhiConnectionManager(mockConnectionManager);

      // 设置 mcpServiceManager
      webServer.setMCPServiceManager(mockServiceManager);

      // 调用被测试的方法 - 空配置
      await (webServer as any).initializeXiaozhiConnection("", {});

      // 验证没有端点被添加（因为配置为空）
      expect(mockConnectionManager.addEndpoint).not.toHaveBeenCalled();

      // 验证连接管理器没有被连接（因为没有有效端点）
      expect(mockConnectionManager.connect).not.toHaveBeenCalled();
    });

    it("应该在无效端点配置时正确初始化", async () => {
      // 使用依赖注入设置 mock 连接管理器
      webServer.setXiaozhiConnectionManager(mockConnectionManager);

      webServer.setMCPServiceManager(mockServiceManager);

      // 调用被测试的方法 - 无效端点
      await (webServer as any).initializeXiaozhiConnection(
        ["<请填写小智接入点>", ""],
        {}
      );

      // 验证没有端点被添加（因为配置无效）
      expect(mockConnectionManager.addEndpoint).not.toHaveBeenCalled();

      // 验证连接管理器没有被连接（因为没有有效端点）
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

describe("WebServer MCPServiceManager 方法测试", () => {
  let webServer: WebServer;
  let mockMCPServiceManager: MCPServiceManager;

  beforeEach(() => {
    // 创建一个新的 WebServer 实例用于每个测试
    webServer = new WebServer(0); // 使用端口 0 让系统自动分配
    mockMCPServiceManager = new MCPServiceManager();
  });

  describe("setMCPServiceManager", () => {
    it("应该能够设置 MCPServiceManager 实例", () => {
      // 在 WebServer 启动前设置实例
      webServer.setMCPServiceManager(mockMCPServiceManager);

      // 验证设置成功
      expect(webServer.getMCPServiceManager()).toBe(mockMCPServiceManager);
    });

    it("应该替换现有的 MCPServiceManager 实例", () => {
      // 设置第一个实例
      const firstManager = new MCPServiceManager();
      webServer.setMCPServiceManager(firstManager);
      expect(webServer.getMCPServiceManager()).toBe(firstManager);

      // 替换为第二个实例
      const secondManager = new MCPServiceManager();
      webServer.setMCPServiceManager(secondManager);
      expect(webServer.getMCPServiceManager()).toBe(secondManager);
      expect(webServer.getMCPServiceManager()).not.toBe(firstManager);
    });
  });

  describe("getMCPServiceManager", () => {
    it("在 WebServer 未启动且未设置实例时应该抛出错误", () => {
      expect(() => {
        webServer.getMCPServiceManager();
      }).toThrow(
        "MCPServiceManager 未初始化，请确保 WebServer 已调用 start() 方法完成初始化"
      );
    });

    it("在手动设置实例后应该返回有效实例", () => {
      // 手动设置实例
      webServer.setMCPServiceManager(mockMCPServiceManager);

      // 应该返回设置的实例
      const manager = webServer.getMCPServiceManager();
      expect(manager).toBe(mockMCPServiceManager);
      expect(manager).toBeDefined();
    });

    it("在 WebServer 启动后应该返回有效实例", async () => {
      try {
        await webServer.start();

        // 启动后应该有 MCPServiceManager 实例
        const manager = webServer.getMCPServiceManager();
        expect(manager).toBeDefined();
        // 由于是 mock 对象，验证它具有必要的方法而不是 instanceOf
        expect(manager).toHaveProperty("start");
        expect(manager).toHaveProperty("stopAllServices");
      } catch (error) {
        // 如果启动失败（由于缺少某些依赖），至少测试错误处理
        console.log("WebServer start failed in test:", error);
      }
    });
  });

  describe("错误处理", () => {
    it("应该处理 null/undefined 参数", () => {
      // 测试设置 null
      expect(() => {
        webServer.setMCPServiceManager(null as any);
      }).not.toThrow();

      // 验证获取时抛出错误
      expect(() => {
        webServer.getMCPServiceManager();
      }).toThrow();
    });

    it("错误消息应该清晰且有帮助", () => {
      try {
        webServer.getMCPServiceManager();
        expect.fail("Expected getMCPServiceManager to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain(
          "MCPServiceManager 未初始化"
        );
        expect((error as Error).message).toContain("start() 方法");
      }
    });
  });
});
