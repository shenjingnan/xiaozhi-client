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
    setToolEnabled: vi.fn(),
  };
  return {
    configManager: mockConfigManager,
    ConfigManager: vi.fn(() => mockConfigManager),
  };
});
vi.mock("./logger");

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
});
