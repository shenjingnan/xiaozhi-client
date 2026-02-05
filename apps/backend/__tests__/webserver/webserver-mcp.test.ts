/**
 * WebServer MCP 路由测试
 * 测试 MCP POST/GET 请求
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebServer } from "../../WebServer";
import {
  createConfigMock,
  createEndpointManagerMock,
  createHandlerMocks,
  createLoggerMock,
  createServicesIndexMock,
  getAvailablePort,
  setupDefaultConfigMocks,
} from "./test-setup.js";

// 配置所有必需的 mock
vi.mock("@xiaozhi-client/config", createConfigMock);
vi.mock("../../Logger", createLoggerMock);
vi.mock("@/services/index.js", createServicesIndexMock);
vi.mock("@xiaozhi-client/endpoint", createEndpointManagerMock);
vi.mock("../../handlers/mcp.handler", () => {
  const mocks = createHandlerMocks();
  return { MCPRouteHandler: mocks.MCPRouteHandler };
});

describe("WebServer MCP 路由测试", () => {
  let webServer: WebServer;
  let mockConfigManager: any;
  let currentPort: number;

  beforeEach(async () => {
    const { configManager } = await import("@xiaozhi-client/config");
    mockConfigManager = configManager;
    currentPort = await getAvailablePort();
    setupDefaultConfigMocks(mockConfigManager, currentPort);
    webServer = new WebServer(currentPort);
    await webServer.start();
  });

  afterEach(async () => {
    if (webServer) {
      try {
        await webServer.stop();
      } catch (error) {
        console.warn("Failed to stop webServer in afterEach:", error);
      }
      webServer = null as any;
    }
    vi.clearAllMocks();
  });

  describe("MCP 请求处理", () => {
    it("应该处理 MCP POST 请求", async () => {
      const mcpRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {},
      };

      const response = await fetch(`http://localhost:${currentPort}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mcpRequest),
      });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.jsonrpc).toBe("2.0");
      expect(data.id).toBe(1);
    });
  });
});
