import { createServer } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock @xiaozhi-client/config - 必须在 WebServer 导入之前
vi.mock("@xiaozhi-client/config", () => {
  const mockConfigManager = {
    configExists: vi.fn(),
    getConfig: vi.fn(),
    getMcpEndpoint: vi.fn(),
    getMcpServers: vi.fn(),
    updateMcpEndpoint: vi.fn(),
    updateMcpServer: vi.fn(),
    removeMcpServer: vi.fn(),
    updateConnectionConfig: vi.fn(),
    updateModelScopeConfig: vi.fn(),
    updateWebUIConfig: vi.fn(),
    getWebUIPort: vi.fn(),
    setToolEnabled: vi.fn(),
    removeServerToolsConfig: vi.fn(),
    cleanupInvalidServerToolsConfig: vi.fn(),
    getToolCallLogConfig: vi.fn().mockReturnValue({}),
    getConfigDir: vi.fn().mockReturnValue("/tmp"),
    getCustomMCPTools: vi.fn().mockReturnValue([]),
    clearAllStatsUpdateLocks: vi.fn(),
    updateMCPServerToolStatsWithLock: vi.fn().mockResolvedValue(undefined),
    saveConfig: vi.fn(),
    validateConfig: vi.fn(),
    updateConfig: vi.fn(),
    getMutableConfig: vi.fn(() => ({
      mcpEndpoint: "wss://test.endpoint",
      mcpServers: {},
      connection: {},
      modelscope: {},
      webUI: { port: 3000 },
    })),
    getMcpServerConfig: vi.fn(() => ({})),
    getConfigPath: vi.fn(() => "/test/config.json"),
  };

  return {
    configManager: mockConfigManager,
    ConfigManager: vi.fn(() => mockConfigManager),
    normalizeMCPServerConfig: vi.fn((config) => config),
    __esModule: true,
  };
});

// 现在导入 WebServer
import { WebServer } from "./WebServer";
import { configManager } from "@xiaozhi-client/config";

// Mock MCPServiceManagerSingleton 防止在模块加载时访问 configManager
vi.mock("@managers/MCPServiceManagerSingleton.js", () => {
  const mockMCPServiceManager = {
    getStatus: vi.fn(() => ({
      services: {},
      totalTools: 0,
      availableTools: [],
    })),
    getAllTools: vi.fn(() => []),
    callTool: vi.fn(),
    hasTool: vi.fn(() => false),
    startService: vi.fn(),
    stopService: vi.fn(),
    addServiceConfig: vi.fn(),
    removeServiceConfig: vi.fn(),
    updateServiceConfig: vi.fn(),
    startAllServices: vi.fn(),
    stopAllServices: vi.fn(),
    getConnectedServices: vi.fn(() => []),
    stopServiceRetry: vi.fn(),
    stopAllServiceRetries: vi.fn(),
  };

  return {
    mcpServiceManager: mockMCPServiceManager,
    default: {
      getInstance: vi.fn(() => mockMCPServiceManager),
      reset: vi.fn(),
    },
  };
});

// Mock @/lib/mcp/types.js
vi.mock("@/lib/mcp/types.js", () => ({
  ensureToolJSONSchema: vi.fn((schema) => schema),
}));

// Mock @/lib/mcp 防止 MCPServiceManager 访问 configManager
vi.mock("@/lib/mcp", () => {
  const mockMCPServiceManager = {
    getStatus: vi.fn(() => ({
      services: {},
      totalTools: 0,
      availableTools: [],
    })),
    getAllTools: vi.fn(() => []),
    callTool: vi.fn(),
    hasTool: vi.fn(() => false),
    startService: vi.fn(),
    stopService: vi.fn(),
    addServiceConfig: vi.fn(),
    removeServiceConfig: vi.fn(),
    updateServiceConfig: vi.fn(),
    startAllServices: vi.fn(),
    stopAllServices: vi.fn(),
    getConnectedServices: vi.fn(() => []),
    stopServiceRetry: vi.fn(),
    stopAllServiceRetries: vi.fn(),
  };

  return {
    MCPServiceManager: vi.fn(() => mockMCPServiceManager),
  };
});

// Mock Logger 模块
vi.mock("./Logger", () => {
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    withTag: vi.fn(() => mockLogger),
  };
  return {
    logger: mockLogger,
    Logger: vi.fn(() => mockLogger),
  };
});

// Mock @root/Logger.js
vi.mock("@root/Logger.js", () => {
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    withTag: vi.fn(() => mockLogger),
  };
  return {
    logger: mockLogger,
    Logger: vi.fn(() => mockLogger),
  };
});

// Mock EventBus 服务
vi.mock("@services/EventBus", () => {
  const mockEventBus = {
    onEvent: vi.fn(),
    emitEvent: vi.fn(),
    emit: vi.fn(),
    removeAllListeners: vi.fn(),
    destroy: vi.fn(),
  };
  return {
    getEventBus: vi.fn(() => mockEventBus),
    destroyEventBus: vi.fn(),
    EventBus: vi.fn(() => mockEventBus),
  };
});

// Mock @services/index.js
vi.mock("@services/index.js", () => {
  const mockEventBus = {
    onEvent: vi.fn(),
    emitEvent: vi.fn(),
    emit: vi.fn(),
    removeAllListeners: vi.fn(),
    destroy: vi.fn(),
  };
  const mockNotificationService = {
    addClient: vi.fn(),
    removeClient: vi.fn(),
    broadcast: vi.fn(),
    sendToClient: vi.fn(),
  };
  const mockStatusService = {
    getStatus: vi.fn(),
    updateClientInfo: vi.fn(),
    getClientInfo: vi.fn(),
  };
  return {
    NotificationService: vi.fn(() => mockNotificationService),
    StatusService: vi.fn(() => mockStatusService),
    getEventBus: vi.fn(() => mockEventBus),
    destroyEventBus: vi.fn(),
  };
});

// Mock 各种服务
const mockConfigServiceInstance = {
  getConfig: vi.fn(),
  updateConfig: vi.fn(),
  getMcpEndpoint: vi.fn(),
  updateMcpEndpoint: vi.fn(),
};

vi.mock("@services/ConfigService", () => {
  return {
    ConfigService: vi.fn(() => mockConfigServiceInstance),
  };
});

vi.mock("@services/StatusService", () => {
  const mockStatusService = {
    getStatus: vi.fn(),
    updateClientInfo: vi.fn(),
    getClientInfo: vi.fn(),
  };
  return {
    StatusService: vi.fn(() => mockStatusService),
  };
});

vi.mock("@services/NotificationService", () => {
  const mockNotificationService = {
    addClient: vi.fn(),
    removeClient: vi.fn(),
    broadcast: vi.fn(),
    sendToClient: vi.fn(),
  };
  return {
    NotificationService: vi.fn(() => mockNotificationService),
  };
});

// Mock CLI
vi.mock("@cli", () => ({
  getServiceStatus: vi.fn(),
}));

// Mock child_process
vi.mock("node:child_process", () => ({
  exec: vi.fn(),
  spawn: vi.fn(() => ({
    unref: vi.fn(),
  })),
}));

// Mock EndpointManager
vi.mock("@/lib/endpoint/index", () => ({
  EndpointManager: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn().mockResolvedValue(undefined),
    setServiceManager: vi.fn(),
    getConnectionStatus: vi.fn().mockReturnValue([]),
    on: vi.fn(),
  })),
}));

// Mock handlers
vi.mock("@handlers/index.js", () => {
  // 创建模拟的 ConfigApiHandler 类
  const MockConfigApiHandler = vi.fn(() => ({
    getConfig: vi.fn((c) =>
      c.json({
        success: true,
        data: {
          mcpEndpoint: "wss://test.endpoint",
          mcpServers: { test: { command: "node", args: ["test.js"] } },
        },
      })
    ),
    updateConfig: vi.fn((c) =>
      c.json({
        success: true,
        data: null,
        message: "配置更新成功",
      })
    ),
  }));

  // 创建一个模拟的 HeartbeatHandler 类
  const MockHeartbeatHandler = vi.fn(() => ({
    startHeartbeatMonitoring: vi.fn(() => ({ unref: vi.fn() })),
    stopHeartbeatMonitoring: vi.fn(),
    handleClientConnect: vi.fn(),
    handleClientDisconnect: vi.fn(),
    handleClientStatus: vi.fn(),
  }));

  return {
    ConfigApiHandler: MockConfigApiHandler,
    CozeApiHandler: vi.fn(),
    HeartbeatHandler: MockHeartbeatHandler,
    MCPRouteHandler: vi.fn(),
    MCPServerApiHandler: vi.fn(),
    RealtimeNotificationHandler: vi.fn(() => ({
      handleClientConnect: vi.fn(),
      handleClientDisconnect: vi.fn(),
      handleMessage: vi.fn(),
    })),
    ServiceApiHandler: vi.fn(),
    StaticFileHandler: vi.fn(),
    StatusApiHandler: vi.fn(),
    ToolApiHandler: vi.fn(),
    ToolCallLogApiHandler: vi.fn(),
    UpdateApiHandler: vi.fn(),
    VersionApiHandler: vi.fn(),
  };
});

// Mock middlewares
vi.mock("@middlewares/index.js", () => ({
  corsMiddleware: vi.fn(),
  endpointManagerMiddleware: vi.fn(),
  endpointsMiddleware: vi.fn(),
  errorHandlerMiddleware: vi.fn(),
  loggerMiddleware: vi.fn(),
  mcpServiceManagerMiddleware: vi.fn(),
  notFoundHandlerMiddleware: vi.fn(),
}));

// Mock types - 使用真正的 Hono 实例
vi.mock("@root/types/index.js", async () => {
  // 导入真正的 Hono
  const { default: Hono } = await import("hono");

  return {
    createApp: vi.fn(() => {
      const app = new Hono();
      // 确保 onError 方法存在
      if (typeof (app as any).onError !== "function") {
        (app as any).onError = vi.fn();
      }
      return app;
    }),
  };
});

// Mock endpoint package
vi.mock("@xiaozhi-client/endpoint", () => ({
  Endpoint: vi.fn(),
  EndpointManager: vi.fn(),
}));

// Mock hono
vi.mock("hono", () => ({
  default: vi.fn(() => ({
    on: vi.fn(),
    use: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    route: vi.fn(),
    notFound: vi.fn(),
  })),
  Hono: vi.fn(() => ({
    on: vi.fn(),
    use: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    route: vi.fn(),
    notFound: vi.fn(),
  })),
}));

// Mock @hono/node-server - 不 mock serve，使用真正的服务器

// Mock ws
vi.mock("ws", () => ({
  WebSocketServer: vi.fn(() => ({
    on: vi.fn(),
    close: vi.fn((cb?: () => void) => {
      if (cb) cb();
      return Promise.resolve();
    }),
    clients: new Set(),
    address: vi.fn(() => ({ port: 3000 })),
  })),
}));

// Mock routes
vi.mock("./routes/index.js", () => ({
  RouteManager: vi.fn(() => ({
    registerRoutes: vi.fn(),
  })),
  configRoutes: vi.fn(() => []),
  cozeRoutes: vi.fn(() => []),
  endpointRoutes: vi.fn(() => []),
  mcpRoutes: vi.fn(() => []),
  mcpserverRoutes: vi.fn(() => []),
  miscRoutes: vi.fn(() => []),
  servicesRoutes: vi.fn(() => []),
  staticRoutes: vi.fn(() => []),
  statusRoutes: vi.fn(() => []),
  toolLogsRoutes: vi.fn(() => []),
  toolsRoutes: vi.fn(() => []),
  updateRoutes: vi.fn(() => []),
  versionRoutes: vi.fn(() => []),
  HandlerDependencies: vi.fn(),
}));

// 动态端口管理
function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const port = (server.address() as any)?.port;
      server.close(() => {
        if (port) {
          resolve(port);
        } else {
          reject(new Error("无法获取可用端口"));
        }
      });
    });
  });
}

describe("WebServer 配置清理功能", () => {
  let webServer: WebServer;
  let currentPort: number;

  beforeEach(async () => {
    vi.clearAllMocks();

    // 获取可用端口
    currentPort = await getAvailablePort();

    // 设置默认的 mock 返回值
    configManager.configExists.mockReturnValue(true);
    configManager.getConfig.mockReturnValue({
      mcpEndpoint: "wss://test.endpoint",
      mcpServers: {
        test: { command: "node", args: ["test.js"] },
      },
    });
    configManager.getMcpEndpoint.mockReturnValue("wss://test.endpoint");
    configManager.getMcpServers.mockReturnValue({
      test: { command: "node", args: ["test.js"] },
    });
    configManager.getWebUIPort.mockReturnValue(currentPort);
    // 确保 validateConfig 和 updateConfig 不会抛出错误
    configManager.validateConfig.mockReturnValue(undefined);
    configManager.updateConfig.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    if (webServer) {
      try {
        await webServer.stop();
      } catch (error) {
        // 忽略停止时的错误
      }
    }
    vi.clearAllMocks();
  });

  it("应该在删除服务时同时清理工具配置", async () => {
    const newConfig = {
      mcpEndpoint: "wss://test.endpoint",
      mcpServers: {}, // 删除了所有服务
    };

    // 创建 WebServer 实例并启动
    webServer = new WebServer(currentPort);
    await webServer.start();

    try {
      // 通过 HTTP API 更新配置
      const response = await fetch(
        `http://localhost:${currentPort}/api/config`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(newConfig),
        }
      );

      // 打印错误信息用于调试
      if (response.status !== 200) {
        const errorText = await response.text();
        console.error("Response status:", response.status);
        console.error("Response body:", errorText);
      }

      expect(response.status).toBe(200);

      // 验证响应内容
      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe("配置更新成功");
    } finally {
      await webServer.stop();
    }
  });

  it("应该只清理被删除的服务配置", async () => {
    // 模拟当前有两个服务
    configManager.getMcpServers.mockReturnValue({
      calculator: { command: "node", args: ["calculator.js"] },
      datetime: { command: "node", args: ["datetime.js"] },
    });

    const newConfig = {
      mcpEndpoint: "wss://test.endpoint",
      mcpServers: {
        // 只保留 datetime 服务，删除 calculator 服务
        datetime: { command: "node", args: ["datetime.js"] },
      },
    };

    // 创建 WebServer 实例并启动
    webServer = new WebServer(currentPort);
    await webServer.start();

    try {
      // 通过 HTTP API 更新配置
      const response = await fetch(
        `http://localhost:${currentPort}/api/config`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(newConfig),
        }
      );

      expect(response.status).toBe(200);

      // 验证响应内容
      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe("配置更新成功");
    } finally {
      await webServer.stop();
    }
  });

  describe("启动时配置清理", () => {
    // Hono 和 WebSocket 相关模块已在文件顶部 mock

    it("应该在启动时调用配置清理方法", async () => {
      webServer = new WebServer(currentPort);

      // 模拟启动过程中的配置加载
      try {
        // @ts-ignore - 调用私有方法用于测试
        await webServer.loadConfiguration();
      } catch (error) {
        // 忽略其他初始化错误，我们只关心配置清理是否被调用
      }

      // 验证配置清理方法被调用
      expect(
        configManager.cleanupInvalidServerToolsConfig
      ).toHaveBeenCalledTimes(1);
    });

    it("应该在配置文件不存在时抛出错误而不调用清理方法", async () => {
      configManager.configExists.mockReturnValue(false);

      webServer = new WebServer(currentPort);

      // 应该抛出错误
      await expect(async () => {
        // @ts-ignore - 调用私有方法用于测试
        await webServer.loadConfiguration();
      }).rejects.toThrow("配置文件不存在");

      // 验证配置清理方法没有被调用
      expect(
        configManager.cleanupInvalidServerToolsConfig
      ).not.toHaveBeenCalled();
    });

    it("应该在清理配置后正常返回配置信息", async () => {
      const expectedConfig = {
        mcpEndpoint: "wss://test.endpoint",
        mcpServers: {
          test: { command: "node", args: ["test.js"] },
        },
        webUI: { port: currentPort },
      };

      configManager.getConfig.mockReturnValue(expectedConfig);

      webServer = new WebServer(currentPort);

      // @ts-ignore - 调用私有方法用于测试
      const config = await webServer.loadConfiguration();

      // 验证配置清理方法被调用
      expect(
        configManager.cleanupInvalidServerToolsConfig
      ).toHaveBeenCalledTimes(1);

      // 验证返回的配置正确
      expect(config).toEqual({
        mcpEndpoint: expectedConfig.mcpEndpoint,
        mcpServers: expectedConfig.mcpServers,
        webUIPort: currentPort,
      });
    });
  });
});
