/**
 * WebServer 版本 API 测试
 * 测试版本信息请求和缓存管理
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
vi.mock("../../handlers/version.handler", () => {
  const mocks = createHandlerMocks();
  return { VersionApiHandler: mocks.VersionApiHandler };
});

describe("WebServer 版本 API 测试", () => {
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

  describe("版本信息", () => {
    it("应该处理版本信息请求", async () => {
      const response = await fetch(
        `http://localhost:${currentPort}/api/version`
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.version).toBeDefined();
    });

    it("应该处理简单版本请求", async () => {
      const response = await fetch(
        `http://localhost:${currentPort}/api/version/simple`
      );
      expect(response.status).toBe(200);

      const text = await response.text();
      expect(text).toBe("1.0.0");
    });

    it("应该处理版本缓存清理", async () => {
      const response = await fetch(
        `http://localhost:${currentPort}/api/version/cache`,
        {
          method: "DELETE",
        }
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });
});
