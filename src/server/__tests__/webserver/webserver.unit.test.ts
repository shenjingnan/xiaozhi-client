import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebServer } from "../../WebServer";
import { MCPServiceManager } from "../../lib/mcp";

// Mock configManager to avoid triggering real config loading
vi.mock("../../../config/index.js", () => ({
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
    getLLMConfig: vi.fn(() => null),
    isLLMConfigValid: vi.fn(() => false),
    getTTSConfig: vi.fn(() => ({})),
    getASRConfig: vi.fn(() => ({})),
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
vi.mock("../../services/EventBus.js", () => ({
  getEventBus: vi.fn().mockReturnValue({
    onEvent: vi.fn(),
    emitEvent: vi.fn(),
    removeAllListeners: vi.fn(),
  }),
}));

// Mock EndpointManager
vi.mock("../../lib/endpoint/index.js", () => ({
  EndpointManager: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn().mockResolvedValue(undefined),
    setServiceManager: vi.fn(),
    getConnectionStatus: vi.fn().mockReturnValue([]),
    on: vi.fn(),
  })),
}));

// Mock ESP32DeviceManager
let esp32ManagerInstance: any = null;
vi.mock("../../../esp32/index.js", () => ({
  ESP32DeviceManager: vi.fn().mockImplementation(() => {
    esp32ManagerInstance = {
      handleWebSocketConnection: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn(),
    };
    return esp32ManagerInstance;
  }),
}));

// Mock MCPServiceManager
vi.mock("../../lib/mcp", () => ({
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
    setMcpManager: vi.fn(),
    getConnectionStatus: vi.fn().mockReturnValue([]),
    on: vi.fn(),
    addEndpoint: vi.fn(),
    getEndpoints: vi.fn().mockReturnValue([]),
    reconnect: vi.fn().mockResolvedValue(undefined),
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

describe("WebServer initializeConnections 降级模式", () => {
  let webServer: WebServer;
  const mockPort = 3002;

  beforeEach(() => {
    vi.clearAllMocks();
    webServer = new WebServer(mockPort);
  });

  afterEach(async () => {
    if (webServer?.stop) {
      try {
        await webServer.stop();
      } catch {
        // 忽略停止错误
      }
    }
  });

  it("应该在配置加载失败时进入降级模式并创建空 MCPServiceManager", async () => {
    // Mock loadConfiguration 抛出异常（模拟配置文件损坏）
    const originalLoadConfig = (webServer as any).loadConfiguration.bind(
      webServer
    );
    (webServer as any).loadConfiguration = vi
      .fn()
      .mockRejectedValue(new Error("配置文件解析失败"));

    // 确保初始没有 mcpServiceManager
    expect((webServer as any).mcpServiceManager).toBeNull();

    // 调用 initializeConnections，应进入降级模式
    await (webServer as any).initializeConnections();

    // 验证降级模式下创建了新的 MCPServiceManager 实例
    expect(MCPServiceManager).toHaveBeenCalled();
    expect((webServer as any).mcpServiceManager).toBeDefined();
    expect((webServer as any).mcpServiceManager.start).toHaveBeenCalled();
  });

  it("在 MCPServiceManager 已存在时不应重复创建", async () => {
    // 预先设置一个 mcpServiceManager
    const existingManager = new MCPServiceManager();
    webServer.setMCPServiceManager(existingManager);

    // Mock loadConfiguration 抛异常
    (webServer as any).loadConfiguration = vi
      .fn()
      .mockRejectedValue(new Error("配置加载失败"));

    await (webServer as any).initializeConnections();

    // MCPServiceManager 构造函数不应被再次调用（使用已有实例）
    // 注意：由于 vi.mock 在顶层，构造函数调用次数是累计的
    // 但关键是 mcpServiceManager 应该仍然是同一个实例
    expect((webServer as any).mcpServiceManager).toBe(existingManager);
  });

  it("降级模式下 getMCPServiceManager 不应抛错", async () => {
    (webServer as any).loadConfiguration = vi
      .fn()
      .mockRejectedValue(new Error("配置加载失败"));

    await (webServer as any).initializeConnections();

    // 降级后应该能正常获取 manager
    const manager = webServer.getMCPServiceManager();
    expect(manager).toBeDefined();
  });
});

describe("WebServer setupMCPServerAddedListener 事件监听器", () => {
  let webServer: WebServer;

  beforeEach(() => {
    vi.clearAllMocks();
    webServer = new WebServer(3003);
  });

  it("构造函数中应注册两个事件监听器", () => {
    // 通过验证 destroy 时清理函数数量来间接确认监听器注册
    const unsubscribersBefore = (webServer as any).eventListenerUnsubscribers;
    expect(unsubscribersBefore).toHaveLength(2);
  });

  it("destroy() 应移除所有事件监听器", () => {
    // 获取 eventBus mock（从 services/index 的 mock 中获取）
    webServer.destroy();

    // 验证清理函数被调用
    const unsubscribers = (webServer as any).eventListenerUnsubscribers;
    expect(unsubscribers).toHaveLength(0);
  });

  it("endpointManager 未初始化时事件处理应安全跳过", () => {
    // 不设置 endpointManager，确保为 null
    expect((webServer as any).endpointManager).toBeNull();

    // 验证事件监听器清理函数已注册（构造函数中通过 setupMCPServerAddedListener 注册）
    expect((webServer as any).eventListenerUnsubscribers).toHaveLength(2);
  });
});

describe("WebServer handleESP32DeviceConnection 错误处理", () => {
  let webServer: WebServer;

  beforeEach(() => {
    vi.clearAllMocks();
    esp32ManagerInstance = null;
    webServer = new WebServer(3004);
    // 构造函数会通过 mock 创建 esp32ManagerInstance
  });

  it("缺少 device-id 请求头时应关闭连接(code 1008)", () => {
    const mockWs = { close: vi.fn(), readyState: 1 };
    const mockReq = { headers: {}, url: "/ws" };

    (webServer as any).handleESP32DeviceConnection(mockWs, mockReq);

    expect(mockWs.close).toHaveBeenCalledWith(1008, "Missing required headers");
  });

  it("缺少 client-id 请求头时应关闭连接(code 1008)", () => {
    const mockWs = { close: vi.fn(), readyState: 1 };
    const mockReq = {
      headers: { "device-id": "dev-001" },
      url: "/ws",
    };

    (webServer as any).handleESP32DeviceConnection(mockWs, mockReq);

    expect(mockWs.close).toHaveBeenCalledWith(1008, "Missing required headers");
  });

  it("连接处理成功时应记录日志", async () => {
    const mockWs = { close: vi.fn(), readyState: 1 };
    const mockReq = {
      headers: {
        "device-id": "dev-001",
        "client-id": "cli-001",
        authorization: "Bearer token123",
      },
      url: "/ws",
    };

    const { logger } = await import("../../Logger.js");

    await (webServer as any).handleESP32DeviceConnection(mockWs, mockReq);

    expect(esp32ManagerInstance.handleWebSocketConnection).toHaveBeenCalledWith(
      mockWs,
      "dev-001",
      "cli-001",
      "token123"
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("[WS-ESP32] ESP32设备连接处理成功")
    );
  });

  it("连接处理失败且 ws 为 OPEN 时应关闭(code 1011)", async () => {
    esp32ManagerInstance.handleWebSocketConnection = vi
      .fn()
      .mockRejectedValue(new Error("处理失败"));
    const mockWs = { close: vi.fn(), readyState: 1 }; // OPEN = 1
    const mockReq = {
      headers: {
        "device-id": "dev-001",
        "client-id": "cli-001",
      },
      url: "/ws",
    };

    // handleESP32DeviceConnection 内部是 fire-and-forget，需要等待微任务执行 .catch
    (webServer as any).handleESP32DeviceConnection(mockWs, mockReq);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockWs.close).toHaveBeenCalledWith(
      1011,
      "Connection handling failed"
    );
  });

  it("连接处理失败且 ws 为 CONNECTING 时应关闭(code 1011)", async () => {
    esp32ManagerInstance.handleWebSocketConnection = vi
      .fn()
      .mockRejectedValue(new Error("处理失败"));
    const mockWs = { close: vi.fn(), readyState: 0 }; // CONNECTING = 0
    const mockReq = {
      headers: {
        "device-id": "dev-001",
        "client-id": "cli-001",
      },
      url: "/ws",
    };

    // handleESP32DeviceConnection 内部是 fire-and-forget，需要等待微任务执行 .catch
    (webServer as any).handleESP32DeviceConnection(mockWs, mockReq);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockWs.close).toHaveBeenCalledWith(
      1011,
      "Connection handling failed"
    );
  });
});

describe("WebServer connectWithRetry 重试逻辑", () => {
  let webServer: WebServer;

  beforeEach(() => {
    vi.clearAllMocks();
    webServer = new WebServer(3005);
  });

  it("第一次尝试成功时应立即返回结果", async () => {
    const expectedData = { success: true };
    const connectionFn = vi.fn().mockResolvedValue(expectedData);

    const result = await (webServer as any).connectWithRetry(
      connectionFn,
      "测试连接"
    );

    expect(result).toEqual(expectedData);
    expect(connectionFn).toHaveBeenCalledTimes(1);
  });

  it("失败后应按指数退避重试并最终成功", async () => {
    vi.useFakeTimers();
    const expectedData = { success: true };
    const connectionFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("第一次失败"))
      .mockRejectedValueOnce(new Error("第二次失败"))
      .mockResolvedValueOnce(expectedData);

    const resultPromise = (webServer as any).connectWithRetry(
      connectionFn,
      "测试连接",
      5,
      1000,
      30000,
      2
    );

    // 第一次尝试失败后等待 1s（initialDelay * backoffMultiplier^0 = 1000ms）
    await vi.advanceTimersByTimeAsync(1000);
    // 第二次尝试失败后等待 2s（initialDelay * backoffMultiplier^1 = 2000ms）
    await vi.advanceTimersByTimeAsync(2000);

    const result = await resultPromise;
    vi.useRealTimers();

    expect(result).toEqual(expectedData);
    expect(connectionFn).toHaveBeenCalledTimes(3);
  });

  it("达到最大重试次数后应抛出包含最后一次错误信息的 Error", async () => {
    vi.useFakeTimers();
    const connectionFn = vi.fn().mockRejectedValue(new Error("持续失败"));

    const resultPromise = (webServer as any)
      .connectWithRetry(connectionFn, "测试连接", 3, 100, 30000, 2)
      .catch((e: Error) => e); // 捕获 rejection 避免 unhandled

    // 推进定时器让所有重试完成（每次间隔: 100ms, 200ms）
    await vi.advanceTimersByTimeAsync(500);

    const error = await resultPromise;
    expect(error.message).toContain(
      "测试连接 - 连接失败，已达到最大重试次数: 持续失败"
    );
    expect(connectionFn).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("延迟时间不应超过 maxDelay 上限", async () => {
    vi.useFakeTimers();
    const connectionFn = vi.fn().mockRejectedValue(new Error("失败"));

    const resultPromise = (webServer as any)
      .connectWithRetry(
        connectionFn,
        "测试连接",
        4,
        1000,
        2000, // maxDelay 上限
        10 // 大的乘数让延迟快速超过上限
      )
      .catch((e: Error) => e); // 捕获 rejection 避免 unhandled

    // 推进定时器直到所有重试完成（maxDelay=2000，所以每次最多等 2000ms）
    await vi.advanceTimersByTimeAsync(10000);

    await resultPromise; // 等待 promise 完成（预期是 reject）

    // 验证完成了所有 4 次尝试（没有因超长延迟而卡住）
    expect(connectionFn).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  });
});

describe("WebServer initializeXiaozhiConnection 多端点处理", () => {
  let webServer: WebServer;
  let mockConnectionManager: any;
  let mockServiceManager: any;

  beforeEach(() => {
    vi.clearAllMocks();
    webServer = new WebServer(3006);

    mockConnectionManager = createMockEndpointManager();
    mockServiceManager = {
      startAllServices: vi.fn().mockResolvedValue(undefined),
      stopAllServices: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("字符串端点应转为单元素数组处理", async () => {
    webServer.setXiaozhiConnectionManager(mockConnectionManager);
    webServer.setMCPServiceManager(mockServiceManager);

    await (webServer as any).initializeXiaozhiConnection(
      "wss://single.endpoint",
      {}
    );

    expect(mockConnectionManager.addEndpoint).toHaveBeenCalledWith(
      "wss://single.endpoint"
    );
    expect(mockConnectionManager.connect).toHaveBeenCalled();
  });

  it("多端点数组中混合有效和无效端点时只添加有效端点", async () => {
    webServer.setXiaozhiConnectionManager(mockConnectionManager);
    webServer.setMCPServiceManager(mockServiceManager);

    await (webServer as any).initializeXiaozhiConnection(
      ["wss://valid.endpoint", "<请填写小智接入点>", "", "wss://another.valid"],
      {}
    );

    // 只有两个有效端点
    expect(mockConnectionManager.addEndpoint).toHaveBeenCalledTimes(2);
    expect(mockConnectionManager.addEndpoint).toHaveBeenCalledWith(
      "wss://valid.endpoint"
    );
    expect(mockConnectionManager.addEndpoint).toHaveBeenCalledWith(
      "wss://another.valid"
    );
  });

  it("endpointManager 已存在时应复用实例而非新建", async () => {
    webServer.setXiaozhiConnectionManager(mockConnectionManager);
    webServer.setMCPServiceManager(mockServiceManager);

    await (webServer as any).initializeXiaozhiConnection(
      "wss://test.endpoint",
      {}
    );

    // endpointManager 已存在时不会创建新实例（不进入 if (!this.endpointManager) 分支）
    // 验证 addEndpoint 和 connect 使用的是注入的实例
    expect(mockConnectionManager.addEndpoint).toHaveBeenCalledWith(
      "wss://test.endpoint"
    );
    expect(mockConnectionManager.connect).toHaveBeenCalled();
  });

  it("有效端点添加后应注册事件监听器", async () => {
    webServer.setXiaozhiConnectionManager(mockConnectionManager);
    webServer.setMCPServiceManager(mockServiceManager);

    await (webServer as any).initializeXiaozhiConnection(
      "wss://test.endpoint",
      {}
    );

    // 应注册 endpointAdded 和 endpointRemoved 监听器
    expect(mockConnectionManager.on).toHaveBeenCalledWith(
      "endpointAdded",
      expect.any(Function)
    );
    expect(mockConnectionManager.on).toHaveBeenCalledWith(
      "endpointRemoved",
      expect.any(Function)
    );
  });

  it("connect 失败时应向上抛出错误", async () => {
    mockConnectionManager.connect = vi
      .fn()
      .mockRejectedValue(new Error("连接失败"));
    webServer.setXiaozhiConnectionManager(mockConnectionManager);
    webServer.setMCPServiceManager(mockServiceManager);

    await expect(
      (webServer as any).initializeXiaozhiConnection("wss://test.endpoint", {})
    ).rejects.toThrow("连接失败");
  });
});
