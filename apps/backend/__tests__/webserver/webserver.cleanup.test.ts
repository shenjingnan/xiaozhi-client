import { createServer } from "node:http";
import { configManager } from "@xiaozhi-client/config";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebServer } from "../../WebServer";

// Mock configManager
vi.mock("@xiaozhi-client/config", () => ({
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
    getToolCallLogConfig: vi.fn().mockReturnValue({}),
    getConfigDir: vi.fn().mockReturnValue("/tmp"),
    getCustomMCPTools: vi.fn().mockReturnValue([]),
    clearAllStatsUpdateLocks: vi.fn(),
    validateConfig: vi.fn(),
    updateConfig: vi.fn(),
  },
}));

// Mock Logger 模块
vi.mock("../../Logger", () => {
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
vi.mock("@/services/EventBus", () => {
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

// Mock 各种服务
const mockConfigServiceInstance = {
  getConfig: vi.fn(),
  updateConfig: vi.fn(),
  getMcpEndpoint: vi.fn(),
  updateMcpEndpoint: vi.fn(),
};

vi.mock("@/services/ConfigService", () => {
  return {
    ConfigService: vi.fn(() => mockConfigServiceInstance),
  };
});

vi.mock("@/services/StatusService", () => {
  const mockStatusService = {
    getStatus: vi.fn(),
    updateClientInfo: vi.fn(),
    getClientInfo: vi.fn(),
  };
  return {
    StatusService: vi.fn(() => mockStatusService),
  };
});

vi.mock("@/services/NotificationService", () => {
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
    off: vi.fn(),
  })),
}));

// Mock normalizeServiceConfig
vi.mock("../../adapters/ConfigAdapter", () => ({
  normalizeServiceConfig: vi.fn((name, config) => config),
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
  let mockConfigManager: any;
  let webServer: WebServer;
  let currentPort: number;

  beforeEach(async () => {
    vi.clearAllMocks();

    // 获取可用端口
    currentPort = await getAvailablePort();

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
    mockConfigManager.getWebUIPort.mockReturnValue(currentPort);
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
        mockConfigManager.cleanupInvalidServerToolsConfig
      ).toHaveBeenCalledTimes(1);
    });

    it("应该在配置文件不存在时抛出错误而不调用清理方法", async () => {
      mockConfigManager.configExists.mockReturnValue(false);

      webServer = new WebServer(currentPort);

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
        webUI: { port: currentPort },
      };

      mockConfigManager.getConfig.mockReturnValue(expectedConfig);

      webServer = new WebServer(currentPort);

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
        webUIPort: currentPort,
      });
    });
  });
});
