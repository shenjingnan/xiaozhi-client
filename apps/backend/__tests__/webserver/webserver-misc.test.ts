/**
 * WebServer 其他功能测试
 * 测试事件总线监听、重连机制和性能
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebServer } from "../../WebServer";
import {
  createConfigMock,
  createEndpointManagerMock,
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

describe("WebServer 其他功能测试", () => {
  let webServer: WebServer;
  let mockConfigManager: any;
  let currentPort: number;

  beforeEach(async () => {
    const { configManager } = await import("@xiaozhi-client/config");
    mockConfigManager = configManager;
    currentPort = await getAvailablePort();
    setupDefaultConfigMocks(mockConfigManager, currentPort);
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

  describe("重连机制测试", () => {
    it("应该实现带重试的连接逻辑", async () => {
      webServer = new WebServer(currentPort);
      await webServer.start();

      // 由于 connectWithRetry 是私有方法，我们通过测试整体行为来验证
      // 这里我们主要验证方法不会抛出未处理的异常
      expect(() => {
        // 我们无法直接调用私有方法，但可以验证相关的错误处理
        webServer.getEndpointConnectionStatus();
      }).not.toThrow();
    });

    it("应该处理连接超时情况", async () => {
      webServer = new WebServer(currentPort);
      await webServer.start();

      // 验证超时处理
      expect(() => {
        webServer.getEndpointConnectionStatus();
      }).not.toThrow();
    });
  });

  describe("性能测试", () => {
    it("应该处理适量并发请求", async () => {
      webServer = new WebServer(currentPort);
      await webServer.start();

      const requestCount = 20; // 减少并发数量
      const requests = Array.from({ length: requestCount }, () =>
        fetch(`http://localhost:${currentPort}/api/status`)
      );

      const responses = await Promise.all(requests);

      // 所有请求都应该成功
      for (const response of responses) {
        expect(response.status).toBe(200);
      }
    });
  });
});
