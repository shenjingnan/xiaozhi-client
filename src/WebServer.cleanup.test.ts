import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebServer } from "./WebServer";
import { configManager } from "./configManager";

// Mock configManager
vi.mock("./configManager", () => ({
  configManager: {
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
  },
}));

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

// Mock EventBus 服务
vi.mock("./services/EventBus", () => {
  const mockEventBus = {
    onEvent: vi.fn(),
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

// Mock 各种服务
vi.mock("./services/ConfigService", () => {
  const mockConfigService = {
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
    getMcpEndpoint: vi.fn(),
    updateMcpEndpoint: vi.fn(),
  };
  return {
    ConfigService: vi.fn(() => mockConfigService),
  };
});

vi.mock("./services/StatusService", () => {
  const mockStatusService = {
    getStatus: vi.fn(),
    updateClientInfo: vi.fn(),
    getClientInfo: vi.fn(),
  };
  return {
    StatusService: vi.fn(() => mockStatusService),
  };
});

vi.mock("./services/NotificationService", () => {
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
vi.mock("./cli", () => ({
  getServiceStatus: vi.fn(),
}));

// Mock child_process
vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => ({
    unref: vi.fn(),
  })),
}));

// Mock MCPServiceManagerSingleton
vi.mock("./services/MCPServiceManagerSingleton", () => ({
  MCPServiceManagerSingleton: {
    getInstance: vi.fn(() => ({
      addServiceConfig: vi.fn(),
      startAllServices: vi.fn(),
      getAllTools: vi.fn(() => []),
    })),
  },
}));

// Mock XiaozhiConnectionManagerSingleton
vi.mock("./services/XiaozhiConnectionManagerSingleton", () => ({
  XiaozhiConnectionManagerSingleton: {
    getInstance: vi.fn(() => ({
      setServiceManager: vi.fn(),
      initialize: vi.fn(),
      connect: vi.fn(),
      on: vi.fn(),
    })),
  },
}));

// Mock convertLegacyToNew
vi.mock("./adapters/ConfigAdapter", () => ({
  convertLegacyToNew: vi.fn((name, config) => config),
}));

describe("WebServer 配置清理功能", () => {
  let mockConfigManager: any;
  let webServer: WebServer;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigManager = vi.mocked(configManager);

    // 设置默认的 mock 返回值
    mockConfigManager.configExists.mockReturnValue(true);
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
    mockConfigManager.getWebUIPort.mockReturnValue(9999);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("应该在删除服务时同时清理工具配置", async () => {
    const newConfig = {
      mcpEndpoint: "wss://test.endpoint",
      mcpServers: {}, // 删除了所有服务
    };

    // 创建 WebServer 实例并启动
    const webServerInstance = new WebServer(9999);
    await webServerInstance.start();

    try {
      // 通过 HTTP API 更新配置
      const response = await fetch(`http://localhost:9999/api/config`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newConfig),
      });

      expect(response.status).toBe(200);

      // 验证删除服务的方法被调用
      expect(mockConfigManager.removeMcpServer).toHaveBeenCalledWith("test");

      // 验证清理工具配置的方法被调用
      expect(mockConfigManager.removeServerToolsConfig).toHaveBeenCalledWith(
        "test"
      );
    } finally {
      await webServerInstance.stop();
    }
  });

  it("应该只清理被删除的服务配置", async () => {
    // 模拟当前有两个服务
    mockConfigManager.getMcpServers.mockReturnValue({
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
    const webServerInstance = new WebServer(9999);
    await webServerInstance.start();

    try {
      // 通过 HTTP API 更新配置
      const response = await fetch("http://localhost:9999/api/config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newConfig),
      });

      expect(response.status).toBe(200);

      // 验证只删除了 calculator 服务
      expect(mockConfigManager.removeMcpServer).toHaveBeenCalledWith(
        "calculator"
      );
      expect(mockConfigManager.removeMcpServer).toHaveBeenCalledTimes(1);

      // 验证只清理了 calculator 服务的工具配置
      expect(mockConfigManager.removeServerToolsConfig).toHaveBeenCalledWith(
        "calculator"
      );
      expect(mockConfigManager.removeServerToolsConfig).toHaveBeenCalledTimes(1);
    } finally {
      await webServerInstance.stop();
    }
  });

  describe("启动时配置清理", () => {
    beforeEach(() => {
      // Mock Hono and WebSocket
      vi.doMock("hono", () => ({
        Hono: vi.fn(() => ({
          use: vi.fn(),
          get: vi.fn(),
          put: vi.fn(),
          onError: vi.fn(),
          fetch: vi.fn(),
        })),
      }));

      vi.doMock("hono/cors", () => ({
        cors: vi.fn(),
      }));

      vi.doMock("@hono/node-server", () => ({
        serve: vi.fn(() => ({
          close: vi.fn(),
        })),
        createServer: vi.fn(),
      }));

      vi.doMock("ws", () => ({
        WebSocketServer: vi.fn(() => ({
          clients: new Set(),
          close: vi.fn(),
        })),
      }));
    });

    it("应该在启动时调用配置清理方法", async () => {
      const webServer = new WebServer(9999);

      // 模拟启动过程中的配置加载
      try {
        // @ts-ignore - 调用私有方法用于测试
        await webServer.loadConfiguration();
      } catch (error) {
        // 忽略其他初始化错误，我们只关心配置清理是否被调用
      }

      // 验证配置清理方法被调用
      expect(
        mockConfigManager.cleanupInvalidServerToolsConfig
      ).toHaveBeenCalledTimes(1);
    });

    it("应该在配置文件不存在时抛出错误而不调用清理方法", async () => {
      mockConfigManager.configExists.mockReturnValue(false);

      const webServer = new WebServer(9999);

      // 应该抛出错误
      await expect(async () => {
        // @ts-ignore - 调用私有方法用于测试
        await webServer.loadConfiguration();
      }).rejects.toThrow("配置文件不存在");

      // 验证配置清理方法没有被调用
      expect(
        mockConfigManager.cleanupInvalidServerToolsConfig
      ).not.toHaveBeenCalled();
    });

    it("应该在清理配置后正常返回配置信息", async () => {
      const expectedConfig = {
        mcpEndpoint: "wss://test.endpoint",
        mcpServers: {
          test: { command: "node", args: ["test.js"] },
        },
        webUI: { port: 9999 },
      };

      mockConfigManager.getConfig.mockReturnValue(expectedConfig);

      const webServer = new WebServer(9999);

      // @ts-ignore - 调用私有方法用于测试
      const config = await webServer.loadConfiguration();

      // 验证配置清理方法被调用
      expect(
        mockConfigManager.cleanupInvalidServerToolsConfig
      ).toHaveBeenCalledTimes(1);

      // 验证返回的配置正确
      expect(config).toEqual({
        mcpEndpoint: expectedConfig.mcpEndpoint,
        mcpServers: expectedConfig.mcpServers,
        webUIPort: 9999,
      });
    });
  });
});
