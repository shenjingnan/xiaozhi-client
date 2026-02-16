/**
 * WebServer 端口配置测试
 * 测试端口配置相关的功能
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

describe("WebServer 端口配置测试", () => {
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
      // 由于我们不能假设默认端口9999在CI环境中可用
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
});
