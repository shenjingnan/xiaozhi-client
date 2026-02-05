/**
 * WebServer 集成测试共享 Mock 配置
 * 用于避免在各个测试文件中重复定义 mock
 */

import { vi } from "vitest";

/**
 * 创建 @xiaozhi-client/config 模块的 mock
 */
export const createConfigMock = () => {
  const mockConfigManager = {
    getConfig: vi.fn(),
    getMcpEndpoint: vi.fn(),
    getMcpServers: vi.fn(),
    getMcpServerConfig: vi.fn(),
    updateMcpEndpoint: vi.fn(),
    updateMcpServer: vi.fn(),
    removeMcpServer: vi.fn(),
    updateConnectionConfig: vi.fn(),
    updateModelScopeConfig: vi.fn(),
    updateWebUIConfig: vi.fn(),
    getWebUIPort: vi.fn(),
    setToolEnabled: vi.fn(),
    removeServerToolsConfig: vi.fn(),
    configExists: vi.fn(),
    cleanupInvalidServerToolsConfig: vi.fn(),
    addMcpEndpoint: vi.fn(),
    removeMcpEndpoint: vi.fn(),
    getToolCallLogConfig: vi.fn().mockReturnValue({}),
    getConfigDir: vi.fn().mockReturnValue("/tmp"),
    getCustomMCPTools: vi.fn(() => []),
    getCustomMCPConfig: vi.fn(() => null),
    hasValidCustomMCPTools: vi.fn(() => false),
    clearAllStatsUpdateLocks: vi.fn(),
  };
  return {
    configManager: mockConfigManager,
    ConfigManager: vi.fn(() => mockConfigManager),
  };
};

/**
 * 创建 Logger 模块的 mock
 */
export const createLoggerMock = () => {
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
};

/**
 * 创建 @/services/index.js 模块的 mock
 */
export const createServicesIndexMock = () => {
  const mockEventBus = {
    onEvent: vi.fn().mockReturnThis(),
    emit: vi.fn(),
    emitEvent: vi.fn(),
    removeAllListeners: vi.fn(),
    destroy: vi.fn(),
  };

  const mockStatusServiceInstance = {
    getStatus: vi.fn(() => ({
      client: {
        status: "connected",
        mcpEndpoint: "wss://test.endpoint",
        activeMCPServers: ["test"],
      },
    })),
    updateClientInfo: vi.fn(),
    getClientInfo: vi.fn(() => ({
      status: "connected",
      mcpEndpoint: "wss://test.endpoint",
      activeMCPServers: ["test"],
    })),
    destroy: vi.fn(),
  };

  const mockNotificationServiceInstance = {
    registerClient: vi.fn(),
    unregisterClient: vi.fn(),
    broadcast: vi.fn(),
    sendToClient: vi.fn(),
    getConnectedClients: vi.fn(() => []),
    cleanupDisconnectedClients: vi.fn(),
    destroy: vi.fn(),
  };

  return {
    getEventBus: vi.fn(() => mockEventBus),
    destroyEventBus: vi.fn(),
    EventBus: vi.fn(() => mockEventBus),
    StatusService: vi.fn(() => mockStatusServiceInstance),
    NotificationService: vi.fn(() => mockNotificationServiceInstance),
  };
};

/**
 * 创建 ConfigService 的 mock
 */
export const createConfigServiceMock = () => {
  const mockConfigServiceInstance = {
    getConfig: vi.fn(() => ({
      mcpEndpoint: "wss://test.endpoint",
      mcpServers: {
        test: { command: "node", args: ["test.js"] },
      },
    })),
    updateConfig: vi.fn().mockResolvedValue(undefined),
    getMcpEndpoint: vi.fn(() => "wss://test.endpoint"),
    updateMcpEndpoint: vi.fn().mockResolvedValue(undefined),
  };
  return {
    ConfigService: vi.fn(() => mockConfigServiceInstance),
  };
};

/**
 * 创建 handler mocks 的基础配置
 */
export const createHandlerMocks = () => ({
  // Config Handler
  ConfigApiHandler: vi.fn(() => ({
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
    getMcpEndpoint: vi.fn((c) =>
      c.json({
        success: true,
        data: { endpoint: "wss://test.endpoint" },
      })
    ),
    getMcpEndpoints: vi.fn((c) =>
      c.json({
        success: true,
        data: { endpoints: ["wss://test.endpoint"] },
      })
    ),
    getMcpServers: vi.fn((c) =>
      c.json({
        success: true,
        data: { test: { command: "node", args: ["test.js"] } },
      })
    ),
    getConnectionConfig: vi.fn((c) =>
      c.json({
        success: true,
        data: { timeout: 5000 },
      })
    ),
    reloadConfig: vi.fn((c) =>
      c.json({
        success: true,
        message: "配置重新加载成功",
      })
    ),
    getConfigPath: vi.fn((c) =>
      c.json({
        success: true,
        data: { path: "/test/config.json" },
      })
    ),
    checkConfigExists: vi.fn((c) =>
      c.json({
        success: true,
        data: { exists: true },
      })
    ),
    updateMcpEndpoint: vi.fn((c) =>
      c.json({
        success: true,
        data: null,
        message: "MCP 端点更新成功",
      })
    ),
  })),

  // Status Handler
  StatusApiHandler: vi.fn(() => ({
    getStatus: vi.fn((c) =>
      c.json({
        status: "connected",
        mcpEndpoint: "wss://test.endpoint",
        activeMCPServers: ["test"],
      })
    ),
    getClientStatus: vi.fn((c) => c.json({ status: "connected" })),
    getRestartStatus: vi.fn((c) => c.json({ status: "idle" })),
    checkClientConnected: vi.fn((c) => c.json({ connected: true })),
    getLastHeartbeat: vi.fn((c) => c.json({ lastHeartbeat: Date.now() })),
    getActiveMCPServers: vi.fn((c) => c.json({ servers: ["test"] })),
    updateClientStatus: vi.fn((c) => c.json({ success: true })),
    setActiveMCPServers: vi.fn((c) => c.json({ success: true })),
    resetStatus: vi.fn((c) => c.json({ success: true })),
  })),

  // Service Handler
  ServiceApiHandler: vi.fn(() => ({
    restartService: vi.fn((c) =>
      c.json({
        success: true,
        data: null,
        message: "重启请求已接收",
      })
    ),
    stopService: vi.fn((c) =>
      c.json({
        success: true,
        message: "服务停止请求已接收",
      })
    ),
    startService: vi.fn((c) =>
      c.json({
        success: true,
        message: "服务启动请求已接收",
      })
    ),
    getServiceStatus: vi.fn((c) =>
      c.json({
        success: true,
        data: { status: "running", pid: 12345 },
      })
    ),
    getServiceHealth: vi.fn((c) =>
      c.json({
        success: true,
        data: { healthy: true, uptime: 3600 },
      })
    ),
  })),

  // Static File Handler
  StaticFileHandler: vi.fn(() => ({
    handleStaticFile: vi.fn((c) =>
      c.text("<!DOCTYPE html><html><body>Test</body></html>", 200, {
        "Content-Type": "text/html",
      })
    ),
  })),

  // Realtime Notification Handler
  RealtimeNotificationHandler: vi.fn(() => ({
    handleClientConnect: vi.fn(),
    handleClientDisconnect: vi.fn(),
    handleMessage: vi.fn(),
    sendInitialData: vi.fn(),
  })),

  // Heartbeat Handler
  HeartbeatHandler: vi.fn(() => ({
    handleClientConnect: vi.fn(),
    handleClientDisconnect: vi.fn(),
    handleClientStatus: vi.fn(),
    startHeartbeatMonitoring: vi.fn(() => setInterval(() => {}, 1000)),
    stopHeartbeatMonitoring: vi.fn(),
  })),

  // Version Handler
  VersionApiHandler: vi.fn(() => ({
    getVersion: vi.fn((c) =>
      c.json({
        success: true,
        data: { version: "1.0.0", commit: "abc123" },
      })
    ),
    getVersionSimple: vi.fn((c) => c.text("1.0.0")),
    clearVersionCache: vi.fn((c) =>
      c.json({
        success: true,
        message: "版本缓存已清空",
      })
    ),
  })),

  // MCP Tool Handler
  MCPToolHandler: vi.fn(() => ({
    callTool: vi.fn((c) =>
      c.json({
        success: true,
        data: { result: "tool call result" },
      })
    ),
    listTools: vi.fn((c) =>
      c.json({
        success: true,
        data: { tools: ["tool1", "tool2"] },
      })
    ),
    getCustomTools: vi.fn((c) =>
      c.json({
        success: true,
        data: { tools: ["custom1", "custom2"] },
      })
    ),
    addCustomTool: vi.fn((c) =>
      c.json({
        success: true,
        data: null,
        message: "自定义工具添加成功",
      })
    ),
    updateCustomTool: vi.fn((c) =>
      c.json({
        success: true,
        data: null,
        message: "自定义工具更新成功",
      })
    ),
    removeCustomTool: vi.fn((c) =>
      c.json({
        success: true,
        data: null,
        message: "自定义工具删除成功",
      })
    ),
  })),

  // Coze Handler
  CozeHandler: vi.fn(() => ({
    getWorkspaces: vi.fn((c) =>
      c.json({
        success: true,
        data: { workspaces: ["workspace1", "workspace2"] },
      })
    ),
    getWorkflows: vi.fn((c) =>
      c.json({
        success: true,
        data: { workflows: ["workflow1", "workflow2"] },
      })
    ),
    clearCache: vi.fn((c) =>
      c.json({
        success: true,
        message: "缓存已清空",
      })
    ),
    getCacheStats: vi.fn((c) =>
      c.json({
        success: true,
        data: { cacheSize: 100, hitRate: 0.8 },
      })
    ),
  })),

  // MCP Route Handler
  MCPRouteHandler: vi.fn(() => ({
    handlePost: vi.fn((c) =>
      c.json({
        jsonrpc: "2.0",
        id: 1,
        result: { success: true },
      })
    ),
    handleGet: vi.fn((c) =>
      c.json({
        jsonrpc: "2.0",
        id: 1,
        result: { status: "ok" },
      })
    ),
  })),

  // Endpoint Handler
  EndpointHandler: vi.fn(() => ({
    getEndpointStatus: vi.fn((c) =>
      c.json({
        success: true,
        data: {
          endpoint: "ws://localhost:9999",
          connected: true,
          initialized: true,
        },
      })
    ),
    connectEndpoint: vi.fn((c) =>
      c.json({
        success: true,
        data: {
          endpoint: "ws://localhost:9999",
          connected: true,
          operation: "connect",
        },
      })
    ),
    disconnectEndpoint: vi.fn((c) =>
      c.json({
        success: true,
        data: {
          endpoint: "ws://localhost:9999",
          connected: false,
          operation: "disconnect",
        },
      })
    ),
    addEndpoint: vi.fn((c) =>
      c.json({
        success: true,
        data: {
          endpoint: "ws://new.endpoint",
          connected: false,
          operation: "add",
        },
      })
    ),
    removeEndpoint: vi.fn((c) =>
      c.json({
        success: true,
        data: {
          endpoint: "ws://old.endpoint",
          operation: "remove",
          success: true,
        },
      })
    ),
  })),
});

/**
 * 创建 CLI Container 的 mock
 */
export const createContainerMock = () => ({
  createContainer: vi.fn(() => ({
    get: vi.fn((serviceName: string) => {
      if (serviceName === "serviceManager") {
        return {
          getStatus: vi.fn(),
        };
      }
      return {};
    }),
  })),
});

/**
 * 创建 child_process 的 mock
 */
export const createChildProcessMock = () => ({
  exec: vi.fn(),
  spawn: vi.fn(() => ({
    unref: vi.fn(),
  })),
});

/**
 * 创建 EndpointManager 的 mock
 */
export const createEndpointManagerMock = () => ({
  EndpointManager: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn().mockResolvedValue(undefined),
    setServiceManager: vi.fn(),
    getConnectionStatus: vi.fn().mockReturnValue([]),
    on: vi.fn(),
  })),
  EndpointConnection: vi.fn().mockImplementation(() => ({
    setServiceManager: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
});

/**
 * 创建 adapter.js 的 mock
 */
export const createAdapterMock = () => ({
  normalizeServiceConfig: vi.fn((_name: string, config: unknown) => config),
  isModelScopeURL: vi.fn((url: string) => url.includes("modelscope")),
});

/**
 * 端口管理工具函数
 * 获取可用的随机端口
 */
export const getAvailablePort = async (): Promise<number> => {
  const { createServer } = await import("node:http");
  return new Promise((resolve, reject) => {
    const server = createServer();
    let resolved = false;

    const onError = (err: Error) => {
      if (!resolved) {
        resolved = true;
        server.close();
        reject(err);
      }
    };

    server.on("error", onError);

    server.listen(0, "127.0.0.1", () => {
      if (resolved) return;

      const port = (server.address() as { port?: number })?.port;
      if (!port) {
        resolved = true;
        server.close();
        reject(new Error("Failed to get available port"));
        return;
      }

      // 确保端口完全释放后再解析
      server.close(() => {
        if (!resolved) {
          resolved = true;
          // 额外等待一小段时间确保端口释放
          setTimeout(() => resolve(port), 50);
        }
      });
    });
  });
};

/**
 * 设置默认的 configManager mock 返回值
 */
export const setupDefaultConfigMocks = (
  mockConfigManager: any,
  port: number
) => {
  mockConfigManager.getConfig.mockReturnValue({
    mcpEndpoint: "wss://test.endpoint",
    mcpServers: {
      test: { command: "node", args: ["test.js"] },
    },
  });
  mockConfigManager.getMcpEndpoint.mockReturnValue("wss://test.endpoint");
  mockConfigManager.getMcpServers.mockReturnValue({
    test: { command: "node", args: ["test.js"] },
  });
  mockConfigManager.getWebUIPort.mockReturnValue(port);
  mockConfigManager.configExists.mockReturnValue(true);
  mockConfigManager.updateMcpEndpoint.mockResolvedValue(undefined);
  mockConfigManager.updateWebUIConfig.mockResolvedValue(undefined);
  mockConfigManager.removeMcpServer.mockResolvedValue(undefined);
  mockConfigManager.removeServerToolsConfig.mockResolvedValue(undefined);
};
