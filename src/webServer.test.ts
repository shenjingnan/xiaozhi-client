import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { WebServer } from "./webServer";

vi.mock("./configManager", () => {
  const mockConfigManager = {
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
  };
  return {
    configManager: mockConfigManager,
    ConfigManager: vi.fn(() => mockConfigManager),
  };
});
vi.mock("./logger");
vi.mock("./cli", () => ({
  getServiceStatus: vi.fn(),
}));
vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => ({
    unref: vi.fn(),
  })),
}));

describe("WebServer", () => {
  let webServer: WebServer;
  let mockConfigManager: any;

  beforeEach(async () => {
    const { configManager } = await import("./configManager");
    mockConfigManager = configManager;

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
      await webServer.stop();
    }
    vi.clearAllMocks();
  });

  it("should start the server on the specified port", async () => {
    webServer = new WebServer(9998);
    await webServer.start();

    const response = await fetch("http://localhost:9998/api/status");
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("status");
    expect(data).toHaveProperty("mcpEndpoint");
    expect(data).toHaveProperty("activeMCPServers");
  });

  it("should return config via HTTP API", async () => {
    webServer = new WebServer(9997);
    await webServer.start();

    const response = await fetch("http://localhost:9997/api/config");
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.mcpEndpoint).toBe("wss://test.endpoint");
    expect(data.mcpServers).toHaveProperty("test");
  });

  it("should update config via HTTP API", async () => {
    webServer = new WebServer(9996);
    await webServer.start();

    const newConfig = {
      mcpEndpoint: "wss://new.endpoint",
      mcpServers: {},
    };

    const response = await fetch("http://localhost:9996/api/config", {
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
    webServer = new WebServer(9995);
    await webServer.start();

    const ws = new WebSocket("ws://localhost:9995");
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
    webServer = new WebServer(9994);

    const clientInfo = {
      status: "connected" as const,
      mcpEndpoint: "wss://test.endpoint",
      activeMCPServers: ["test"],
    };

    webServer.updateStatus(clientInfo);
  });

  it("should handle 404 for unknown routes", async () => {
    webServer = new WebServer(9993);
    await webServer.start();

    const response = await fetch("http://localhost:9993/api/unknown");
    expect(response.status).toBe(404);
  });

  describe("端口配置", () => {
    beforeEach(() => {
      mockConfigManager.getWebUIPort.mockReturnValue(8080);
    });

    it("应该使用指定的端口号", async () => {
      webServer = new WebServer(9992);
      await webServer.start();

      const response = await fetch("http://localhost:9992/api/status");
      expect(response.status).toBe(200);
    });

    it("应该在没有指定端口时从配置文件获取端口", async () => {
      mockConfigManager.getWebUIPort.mockReturnValue(8080);
      webServer = new WebServer();
      await webServer.start();

      const response = await fetch("http://localhost:8080/api/status");
      expect(response.status).toBe(200);
      expect(mockConfigManager.getWebUIPort).toHaveBeenCalled();
    });

    it("应该在配置读取失败时使用默认端口", async () => {
      mockConfigManager.getWebUIPort.mockImplementation(() => {
        throw new Error("配置文件不存在");
      });

      webServer = new WebServer();
      await webServer.start();

      // 默认端口 9999
      const response = await fetch("http://localhost:9999/api/status");
      expect(response.status).toBe(200);
    });

    it("应该处理 webUI 配置更新", async () => {
      webServer = new WebServer(9991);
      await webServer.start();

      const newConfig = {
        mcpEndpoint: "wss://test.endpoint",
        mcpServers: {},
        webUI: { port: 8080 },
      };

      const response = await fetch("http://localhost:9991/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig),
      });

      expect(response.status).toBe(200);
      expect(mockConfigManager.updateWebUIConfig).toHaveBeenCalledWith({
        port: 8080,
      });
    });
  });

  describe("Auto Restart Feature", () => {
    let mockGetServiceStatus: any;
    let mockSpawn: any;

    beforeEach(async () => {
      const { getServiceStatus } = await import("./cli");
      const { spawn } = await import("node:child_process");
      mockGetServiceStatus = vi.mocked(getServiceStatus);
      mockSpawn = vi.mocked(spawn);
    });

    it("should trigger restart when config is updated with autoRestart enabled", async () => {
      webServer = new WebServer(9992);
      await webServer.start();

      // Mock service status
      mockGetServiceStatus.mockReturnValue({
        running: true,
        pid: 12345,
        mode: "daemon",
      });

      const newConfig = {
        mcpEndpoint: "wss://test.endpoint",
        mcpServers: {},
        webUI: { autoRestart: true },
      };

      const response = await fetch("http://localhost:9992/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig),
      });

      const result = await response.json();
      expect(response.status).toBe(200);
      expect(result.restarting).toBe(true);

      // Wait for restart to be triggered
      await new Promise((resolve) => setTimeout(resolve, 600));

      expect(mockSpawn).toHaveBeenCalledWith(
        "xiaozhi",
        ["restart", "--daemon"],
        expect.objectContaining({
          detached: true,
          stdio: "ignore",
        })
      );
    });

    it("should not trigger restart when autoRestart is disabled", async () => {
      webServer = new WebServer(9993);
      await webServer.start();

      const newConfig = {
        mcpEndpoint: "wss://test.endpoint",
        mcpServers: {},
        webUI: { autoRestart: false },
      };

      const response = await fetch("http://localhost:9993/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig),
      });

      const result = await response.json();
      expect(response.status).toBe(200);
      expect(result.restarting).toBe(false);

      // Wait to ensure no restart is triggered
      await new Promise((resolve) => setTimeout(resolve, 600));

      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it("should broadcast restart status updates", async () => {
      webServer = new WebServer(9994);
      await webServer.start();

      // Connect a WebSocket client
      const ws = new WebSocket("ws://localhost:9994");
      const messages: any[] = [];

      await new Promise<void>((resolve) => {
        ws.on("open", resolve);
      });

      ws.on("message", (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      // Mock service status
      mockGetServiceStatus.mockReturnValue({
        running: true,
        pid: 12345,
        mode: "daemon",
      });

      const newConfig = {
        mcpEndpoint: "wss://test.endpoint",
        mcpServers: {},
        webUI: { autoRestart: true },
      };

      await fetch("http://localhost:9994/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig),
      });

      // Wait for messages
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check for restart status message
      const restartMessage = messages.find((m) => m.type === "restartStatus");
      expect(restartMessage).toBeDefined();
      expect(restartMessage.data.status).toBe("restarting");

      ws.close();
    });

    it("should start service if not running", async () => {
      webServer = new WebServer(9995);
      await webServer.start();

      // Mock service as not running
      mockGetServiceStatus.mockReturnValue({
        running: false,
      });

      const newConfig = {
        mcpEndpoint: "wss://test.endpoint",
        mcpServers: {},
        webUI: { autoRestart: true },
      };

      await fetch("http://localhost:9995/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig),
      });

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
    });
  });
});
