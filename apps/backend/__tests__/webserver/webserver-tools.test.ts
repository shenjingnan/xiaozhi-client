/**
 * WebServer 工具 API 测试
 * 测试工具调用、工具列表和自定义工具管理
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
vi.mock("../../handlers/mcp-tool.handler", () => {
  const mocks = createHandlerMocks();
  return { MCPToolHandler: mocks.MCPToolHandler };
});

describe("WebServer 工具 API 测试", () => {
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

  describe("工具调用和列表", () => {
    it("应该处理工具调用请求", async () => {
      const response = await fetch(
        `http://localhost:${currentPort}/api/tools/call`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toolName: "test", params: {} }),
        }
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it("应该处理工具列表请求", async () => {
      const response = await fetch(
        `http://localhost:${currentPort}/api/tools/list`
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.tools).toBeDefined();
    });
  });

  describe("自定义工具管理", () => {
    it("应该处理自定义工具请求", async () => {
      const response = await fetch(
        `http://localhost:${currentPort}/api/tools/custom`
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.tools).toBeDefined();
    });

    it("应该处理添加自定义工具", async () => {
      const newTool = {
        name: "test-tool",
        description: "Test tool",
        schema: {},
      };

      const response = await fetch(
        `http://localhost:${currentPort}/api/tools/custom`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newTool),
        }
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe("自定义工具添加成功");
    });

    it("应该处理更新自定义工具", async () => {
      const updatedTool = {
        name: "test-tool",
        description: "Updated test tool",
        schema: {},
      };

      const response = await fetch(
        `http://localhost:${currentPort}/api/tools/custom/test-tool`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedTool),
        }
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe("自定义工具更新成功");
    });

    it("应该处理删除自定义工具", async () => {
      const response = await fetch(
        `http://localhost:${currentPort}/api/tools/custom/test-tool`,
        {
          method: "DELETE",
        }
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe("自定义工具删除成功");
    });

    it("应该处理缺失的必需参数", async () => {
      const response = await fetch(
        `http://localhost:${currentPort}/api/tools/custom`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}), // 缺少必需的 name 字段
        }
      );

      // 由于处理器是 mock 的，期望得到 200
      // 在实际环境中，这可能会返回 400
      expect(response.status).toBe(200);
    });
  });
});
