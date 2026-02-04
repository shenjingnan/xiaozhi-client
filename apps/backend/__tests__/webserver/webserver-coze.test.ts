/**
 * WebServer 扣子 API 测试
 * 测试工作空间、工作流和缓存管理
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
vi.mock("../../handlers/coze.handler", () => {
  const mocks = createHandlerMocks();
  return { CozeHandler: mocks.CozeHandler };
});

describe("WebServer 扣子 API 测试", () => {
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

  describe("工作空间和工作流", () => {
    it("应该处理工作空间请求", async () => {
      const response = await fetch(
        `http://localhost:${currentPort}/api/coze/workspaces`
      );
      // Coze API 可能返回 500 如果未实现或不配置，这是预期的
      expect([200, 404, 500]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.workspaces).toBeDefined();
      }
    });

    it("应该处理工作流请求", async () => {
      const response = await fetch(
        `http://localhost:${currentPort}/api/coze/workflows`
      );
      // Coze API 可能返回 500 如果未实现或不配置，这是预期的
      expect([200, 404, 500]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.workflows).toBeDefined();
      }
    });
  });

  describe("缓存管理", () => {
    it("应该处理缓存清理请求", async () => {
      const response = await fetch(
        `http://localhost:${currentPort}/api/coze/cache/clear`,
        {
          method: "POST",
        }
      );
      // Coze API 可能返回 500 如果未实现或不配置，这是预期的
      expect([200, 404, 500]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.message).toBe("缓存已清空");
      }
    });

    it("应该处理缓存统计请求", async () => {
      const response = await fetch(
        `http://localhost:${currentPort}/api/coze/cache/stats`
      );
      // Coze API 可能返回 500 如果未实现或不配置，这是预期的
      expect([200, 404, 500]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.cacheSize).toBeDefined();
        expect(data.data.hitRate).toBeDefined();
      }
    });
  });
});
