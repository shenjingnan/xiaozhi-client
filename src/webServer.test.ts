import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { ConfigManager } from "./configManager";
import { WebServer } from "./webServer";

vi.mock("./configManager");
vi.mock("./logger");

describe("WebServer", () => {
  let webServer: WebServer;
  let mockConfigManager: any;

  beforeEach(() => {
    mockConfigManager = {
      readConfig: vi.fn().mockResolvedValue({
        mcpEndpoint: "wss://test.endpoint",
        mcpServers: {
          test: { command: "node", args: ["test.js"] },
        },
      }),
      updateConfig: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(ConfigManager).mockImplementation(() => mockConfigManager as any);
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
    expect(mockConfigManager.updateConfig).toHaveBeenCalledWith(newConfig);
  });

  it("should handle WebSocket connections", async () => {
    webServer = new WebServer(9995);
    await webServer.start();

    const ws = new WebSocket("ws://localhost:9995");

    await new Promise<void>((resolve, reject) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "getConfig" }));
      });

      ws.on("message", (data) => {
        const message = JSON.parse(data.toString());
        expect(message.type).toBe("config");
        expect(message.data.mcpEndpoint).toBe("wss://test.endpoint");
        ws.close();
        resolve();
      });

      ws.on("error", reject);
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
