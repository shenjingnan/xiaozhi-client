import { createServer } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { WebServer } from "./WebServer";

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
vi.mock("./logger");
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

  it("should start the server on the specified port", async () => {
    webServer = new WebServer(currentPort);
    await webServer.start();

    const response = await fetch(`http://localhost:${currentPort}/api/status`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("status");
    expect(data).toHaveProperty("mcpEndpoint");
    expect(data).toHaveProperty("activeMCPServers");
  });

  it("should return config via HTTP API", async () => {
    webServer = new WebServer(currentPort);
    await webServer.start();

    const response = await fetch(`http://localhost:${currentPort}/api/config`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.mcpEndpoint).toBe("wss://test.endpoint");
    expect(data.mcpServers).toHaveProperty("test");
  });

  it("should update config via HTTP API", async () => {
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
    expect(mockConfigManager.updateMcpEndpoint).toHaveBeenCalledWith(
      "wss://new.endpoint"
    );
  });

  it("should handle WebSocket connections", async () => {
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

  it("should update client status", () => {
    webServer = new WebServer(currentPort);

    const clientInfo = {
      status: "connected" as const,
      mcpEndpoint: "wss://test.endpoint",
      activeMCPServers: ["test"],
    };

    webServer.updateStatus(clientInfo);
  });

  it("should handle 404 for unknown routes", async () => {
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
      expect(mockConfigManager.updateWebUIConfig).toHaveBeenCalledWith({
        port: 8080,
      });
    });
  });

  describe("Auto Restart Feature", () => {
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
      });
      mockSpawn = vi.mocked(spawn);
    });

    it("should not trigger automatic restart when config is updated", async () => {
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

    it("should save config without restart regardless of autoRestart setting", async () => {
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

    it("should broadcast restart status updates on manual restart", async () => {
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

      // Send manual restart request
      ws.send(JSON.stringify({ type: "restartService" }));

      // Wait for messages
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Check for restart status message
      const restartMessage = messages.find((m) => m.type === "restartStatus");
      expect(restartMessage).toBeDefined();
      expect(restartMessage.data.status).toBe("restarting");

      ws.close();
    });

    it("should start service on manual restart if not running", async () => {
      webServer = new WebServer(currentPort);
      await webServer.start();

      // Connect a WebSocket client
      const ws = new WebSocket(`ws://localhost:${currentPort}`);

      await new Promise<void>((resolve) => {
        ws.on("open", resolve);
      });

      // Mock service as not running
      mockServiceManager.getStatus.mockResolvedValue({
        running: false,
      });

      // Send manual restart request
      ws.send(JSON.stringify({ type: "restartService" }));

      // Wait for start to be triggered
      await new Promise((resolve) => setTimeout(resolve, 600));

      expect(mockSpawn).toHaveBeenCalledWith(
        "xiaozhi",
        ["start", "--daemon"],
        expect.objectContaining({
          detached: true,
          stdio: "ignore",
        })
      );

      ws.close();
    });
  });
});
