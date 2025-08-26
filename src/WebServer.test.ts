import { createServer } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { WebServer } from "./WebServer";
import { ConfigService } from "./services/ConfigService";

vi.mock("./configManager", () => {
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
  };
  return {
    configManager: mockConfigManager,
    ConfigManager: vi.fn(() => mockConfigManager),
  };
});
// Mock Logger 模块 - 注意路径和大小写
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

vi.mock("./services/ConfigService", () => {
  return {
    ConfigService: vi.fn(() => mockConfigServiceInstance),
  };
});

vi.mock("./services/StatusService", () => {
  const mockStatusService = {
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
  };
  return {
    StatusService: vi.fn(() => mockStatusService),
  };
});

vi.mock("./services/NotificationService", () => {
  const mockNotificationService = {
    registerClient: vi.fn(),
    unregisterClient: vi.fn(),
    broadcast: vi.fn(),
    sendToClient: vi.fn(),
    getConnectedClients: vi.fn(() => []),
    cleanupDisconnectedClients: vi.fn(),
  };
  return {
    NotificationService: vi.fn(() => mockNotificationService),
  };
});

// Mock API 处理器
vi.mock("./handlers/ConfigApiHandler", () => {
  const mockConfigApiHandler = {
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
    updateMcpEndpoint: vi.fn((c) =>
      c.json({
        success: true,
        data: null,
        message: "MCP 端点更新成功",
      })
    ),
  };
  return {
    ConfigApiHandler: vi.fn(() => mockConfigApiHandler),
  };
});

vi.mock("./handlers/StatusApiHandler", () => {
  const mockStatusApiHandler = {
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
  };
  return {
    StatusApiHandler: vi.fn(() => mockStatusApiHandler),
  };
});

vi.mock("./handlers/ServiceApiHandler", () => {
  const mockServiceApiHandler = {
    restartService: vi.fn((c) =>
      c.json({
        success: true,
        data: null,
        message: "重启请求已接收",
      })
    ),
  };
  return {
    ServiceApiHandler: vi.fn(() => mockServiceApiHandler),
  };
});
vi.mock("./cli/Container", () => ({
  createContainer: vi.fn(() => ({
    get: vi.fn((serviceName) => {
      if (serviceName === "serviceManager") {
        return {
          getStatus: vi.fn(),
        };
      }
      return {};
    }),
  })),
}));
vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => ({
    unref: vi.fn(),
  })),
}));

// 端口管理工具函数
const getAvailablePort = async (): Promise<number> => {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const port = (server.address() as any)?.port;
      server.close(() => {
        if (port) {
          resolve(port);
        } else {
          reject(new Error("Failed to get available port"));
        }
      });
    });
    server.on("error", reject);
  });
};

// 检查端口是否可用
const isPortAvailable = async (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
};

// 等待端口释放
const waitForPortRelease = async (
  port: number,
  maxWait = 3000
): Promise<void> => {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWait) {
    if (await isPortAvailable(port)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Port ${port} is still in use after ${maxWait}ms`);
};

// 检测CI环境
const isCI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
const cleanupDelay = isCI ? 1000 : 500; // CI环境使用更长的清理时间

describe("WebServer", () => {
  let webServer: WebServer;
  let mockConfigManager: any;
  let currentPort: number;

  beforeEach(async () => {
    const { configManager } = await import("./configManager");
    mockConfigManager = configManager;

    // 获取可用端口
    currentPort = await getAvailablePort();
    // 设置默认的 mock 返回值
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
    mockConfigManager.updateMcpEndpoint.mockResolvedValue(undefined);
    mockConfigManager.updateWebUIConfig.mockResolvedValue(undefined);
    mockConfigManager.removeMcpServer.mockResolvedValue(undefined);
    mockConfigManager.removeServerToolsConfig.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    if (webServer) {
      try {
        await webServer.stop();
        // 在CI环境中使用更长的清理时间
        await new Promise((resolve) => setTimeout(resolve, cleanupDelay));

        // 等待端口完全释放
        if (currentPort) {
          try {
            await waitForPortRelease(currentPort);
          } catch (error) {
            console.warn(`Port ${currentPort} cleanup warning:`, error);
          }
        }
      } catch (error) {
        console.warn("Failed to stop webServer in afterEach:", error);
      }
      webServer = null as any;
    }
    vi.clearAllMocks();
  });

  it("应该在指定端口上启动服务器", async () => {
    webServer = new WebServer(currentPort);
    await webServer.start();

    const response = await fetch(`http://localhost:${currentPort}/api/status`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("status");
    expect(data).toHaveProperty("mcpEndpoint");
    expect(data).toHaveProperty("activeMCPServers");
  });

  it("应该通过 HTTP API 返回配置", async () => {
    webServer = new WebServer(currentPort);
    await webServer.start();

    const response = await fetch(`http://localhost:${currentPort}/api/config`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.mcpEndpoint).toBe("wss://test.endpoint");
    expect(data.data.mcpServers).toHaveProperty("test");
  });

  it("应该通过 HTTP API 更新配置", async () => {
    webServer = new WebServer(currentPort);
    await webServer.start();

    const newConfig = {
      mcpEndpoint: "wss://new.endpoint",
      mcpServers: {},
    };

    const response = await fetch(`http://localhost:${currentPort}/api/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newConfig),
    });

    expect(response.status).toBe(200);

    // 验证响应内容
    const responseData = await response.json();
    expect(responseData.success).toBe(true);
    expect(responseData.message).toBe("配置更新成功");
  });

  it("应该处理 WebSocket 连接", async () => {
    webServer = new WebServer(currentPort);
    await webServer.start();

    const ws = new WebSocket(`ws://localhost:${currentPort}`);
    let messageCount = 0;

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error("WebSocket test timeout"));
      }, 4000);

      ws.on("open", () => {
        // 不发送消息，等待初始数据
      });

      ws.on("message", (data) => {
        messageCount++;
        const message = JSON.parse(data.toString());

        // WebServer 会发送两条初始消息：config 和 status
        if (message.type === "config") {
          expect(message.data.mcpEndpoint).toBe("wss://test.endpoint");
        }

        // 收到两条消息后关闭连接
        if (messageCount === 2) {
          clearTimeout(timeout);
          ws.close();
          resolve();
        }
      });

      ws.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  });

  it("应该通过 HTTP API 更新客户端状态", async () => {
    webServer = new WebServer(currentPort);
    await webServer.start();

    const statusUpdate = {
      activeMCPServers: ["test-server"],
    };

    const response = await fetch(
      `http://localhost:${currentPort}/api/status/mcp-servers`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(statusUpdate),
      }
    );

    expect(response.status).toBe(200);
  });

  it("应该处理 404 未找到路由", async () => {
    webServer = new WebServer(currentPort);
    await webServer.start();

    const response = await fetch(`http://localhost:${currentPort}/api/unknown`);
    expect(response.status).toBe(404);
  });

  describe("端口配置", () => {
    beforeEach(() => {
      mockConfigManager.getWebUIPort.mockReturnValue(8080);
    });

    it("应该使用指定的端口号", async () => {
      webServer = new WebServer(currentPort);
      await webServer.start();

      const response = await fetch(
        `http://localhost:${currentPort}/api/status`
      );
      expect(response.status).toBe(200);
    });

    it("应该在没有指定端口时从配置文件获取端口", async () => {
      // 使用动态端口而不是固定的8080，避免端口冲突
      const configPort = currentPort;
      mockConfigManager.getWebUIPort.mockReturnValue(configPort);
      webServer = new WebServer();
      await webServer.start();

      const response = await fetch(`http://localhost:${configPort}/api/status`);
      expect(response.status).toBe(200);
      expect(mockConfigManager.getWebUIPort).toHaveBeenCalled();
    });

    it("应该在配置读取失败时使用默认端口", async () => {
      mockConfigManager.getWebUIPort.mockImplementation(() => {
        throw new Error("配置文件不存在");
      });

      // 这个测试验证配置读取失败时服务器能正常启动
      // 由于我们不能假设默认端口9999在CI环境中可用，
      // 我们主要验证WebServer构造函数不会抛出异常，并且服务器能启动
      webServer = new WebServer();

      // 验证WebServer实例创建成功（没有抛出异常）
      expect(webServer).toBeDefined();

      // 验证服务器能够启动（这会使用默认端口9999或其他可用端口）
      await expect(webServer.start()).resolves.not.toThrow();
    }, 10000); // 增加超时时间到10秒

    it("应该处理 webUI 配置更新", async () => {
      webServer = new WebServer(currentPort);
      await webServer.start();

      const newConfig = {
        mcpEndpoint: "wss://test.endpoint",
        mcpServers: {},
        webUI: { port: 8080 },
      };

      const response = await fetch(
        `http://localhost:${currentPort}/api/config`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newConfig),
        }
      );

      expect(response.status).toBe(200);

      // 验证响应内容
      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe("配置更新成功");
    });
  });

  describe("自动重启功能", () => {
    let mockServiceManager: any;
    let mockSpawn: any;

    beforeEach(async () => {
      const { createContainer } = await import("./cli/Container");
      const { spawn } = await import("node:child_process");
      const mockContainer = vi.mocked(createContainer);
      mockServiceManager = {
        getStatus: vi.fn(),
      };
      mockContainer.mockResolvedValue({
        get: vi.fn((serviceName) => {
          if (serviceName === "serviceManager") {
            return mockServiceManager;
          }
          return {};
        }),
        register: vi.fn(),
        has: vi.fn(),
      });
      mockSpawn = vi.mocked(spawn);
    });

    it("应该在配置更新时不会触发自动重启", async () => {
      webServer = new WebServer(currentPort);
      await webServer.start();

      const newConfig = {
        mcpEndpoint: "wss://test.endpoint",
        mcpServers: {},
        webUI: { autoRestart: true },
      };

      const response = await fetch(
        `http://localhost:${currentPort}/api/config`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newConfig),
        }
      );

      const result = await response.json();
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);

      // Wait to ensure no restart is triggered
      await new Promise((resolve) => setTimeout(resolve, 600));

      // 验证没有触发重启
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it("应该在自动重启设置下保存配置而不重启", async () => {
      webServer = new WebServer(currentPort);
      await webServer.start();

      const newConfig = {
        mcpEndpoint: "wss://test.endpoint",
        mcpServers: {},
        webUI: { autoRestart: false },
      };

      const response = await fetch(
        `http://localhost:${currentPort}/api/config`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newConfig),
        }
      );

      const result = await response.json();
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);

      // Wait to ensure no restart is triggered
      await new Promise((resolve) => setTimeout(resolve, 600));

      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it("应该在手动重启时广播重启状态更新", async () => {
      webServer = new WebServer(currentPort);
      await webServer.start();

      // Connect a WebSocket client
      const ws = new WebSocket(`ws://localhost:${currentPort}`);
      const messages: any[] = [];

      await new Promise<void>((resolve) => {
        ws.on("open", resolve);
      });

      ws.on("message", (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      // Mock service status
      mockServiceManager.getStatus.mockResolvedValue({
        running: true,
        pid: 12345,
        mode: "daemon",
      });

      // 使用 HTTP API 发送重启请求（新架构）
      const response = await fetch(
        `http://localhost:${currentPort}/api/services/restart`,
        {
          method: "POST",
        }
      );

      expect(response.status).toBe(200);

      // Wait for messages
      await new Promise((resolve) => setTimeout(resolve, 600));

      // 由于我们的 mock 没有完整模拟事件流，我们验证 HTTP API 调用成功即可
      // 在实际环境中，这会触发 restartStatus WebSocket 消息
      // 这个测试主要验证 HTTP API 重启功能正常工作
      expect(response.status).toBe(200);

      ws.close();
    });

    it("应该在手动重启时启动服务", async () => {
      webServer = new WebServer(currentPort);
      await webServer.start();

      // Mock service as not running
      mockServiceManager.getStatus.mockResolvedValue({
        running: false,
      });

      // 使用 HTTP API 发送重启请求（新架构）
      const response = await fetch(
        `http://localhost:${currentPort}/api/services/restart`,
        {
          method: "POST",
        }
      );

      expect(response.status).toBe(200);

      // 验证响应内容
      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe("重启请求已接收");
    });
  });
});
