/**
 * WebServer 生命周期管理测试
 * 测试服务器的构造、初始化、启动、停止和销毁
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

describe("WebServer 生命周期管理测试", () => {
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

  describe("构造函数和初始化", () => {
    it("应该正确初始化所有依赖", () => {
      webServer = new WebServer(currentPort);

      expect(webServer).toBeDefined();
      expect(webServer).toBeInstanceOf(WebServer);
    });

    it("应该在配置读取失败时使用默认端口", () => {
      mockConfigManager.getWebUIPort.mockImplementation(() => {
        throw new Error("配置读取失败");
      });

      expect(() => new WebServer()).not.toThrow();
    });

    it("应该正确设置事件总线", async () => {
      webServer = new WebServer(currentPort);

      // 验证事件总线被正确获取
      const { getEventBus } = await import("@/services/index.js");
      expect(getEventBus).toHaveBeenCalled();
    });
  });

  describe("服务器启动和停止", () => {
    it("应该在指定端口上启动服务器", async () => {
      webServer = new WebServer(currentPort);
      await webServer.start();

      const response = await fetch(
        `http://localhost:${currentPort}/api/status`
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty("status");
      expect(data).toHaveProperty("mcpEndpoint");
      expect(data).toHaveProperty("activeMCPServers");
    });

    it("应该正确停止服务器", async () => {
      webServer = new WebServer(currentPort);
      await webServer.start();

      await expect(webServer.stop()).resolves.not.toThrow();
    });

    it("应该处理服务器已经启动的情况", async () => {
      webServer = new WebServer(currentPort);
      await webServer.start();

      // 再次启动应该不会抛出错误
      await expect(webServer.start()).resolves.not.toThrow();
    });
  });

  describe("销毁", () => {
    it("应该正确销毁服务器实例", async () => {
      webServer = new WebServer(currentPort);
      await webServer.start();

      expect(() => webServer.destroy()).not.toThrow();
    });

    it("应该处理没有 WebSocket 服务器的停止情况", async () => {
      webServer = new WebServer(currentPort);
      // 不启动服务器，直接停止

      await expect(webServer.stop()).resolves.not.toThrow();
    });
  });

  describe("错误处理", () => {
    it("应该处理配置加载错误", async () => {
      mockConfigManager.configExists = vi.fn(() => true);
      mockConfigManager.getConfig = vi.fn(() => {
        throw new Error("配置加载失败");
      });

      webServer = new WebServer(currentPort);

      // 服务器应该能够启动，即使配置加载失败
      await expect(webServer.start()).resolves.not.toThrow();
    });
  });

  describe("连接初始化测试", () => {
    it("应该处理配置文件不存在的情况", async () => {
      mockConfigManager.configExists = vi.fn(() => false);

      webServer = new WebServer(currentPort);

      // 服务器应该能够启动，即使连接初始化失败
      await expect(webServer.start()).resolves.not.toThrow();
    });

    it("应该处理小智连接管理器初始化失败", async () => {
      // Mock EndpointManager constructor to throw
      const { EndpointManager } = await import("@xiaozhi-client/endpoint");
      vi.mocked(EndpointManager).mockImplementation(() => {
        throw new Error("Xiaozhi Connection Manager initialization failed");
      });

      webServer = new WebServer(currentPort);

      // 服务器应该能够启动，即使连接初始化失败
      await expect(webServer.start()).resolves.not.toThrow();
    });
  });

  describe("小智连接状态测试", () => {
    it("应该返回多端点连接状态", async () => {
      webServer = new WebServer(currentPort);
      await webServer.start();

      const status = webServer.getEndpointConnectionStatus();
      expect(status).toBeDefined();
      expect(status.type).toBeDefined();
    });

    it("应该处理无连接的情况", () => {
      webServer = new WebServer(currentPort);

      const status = webServer.getEndpointConnectionStatus();
      expect(status.type).toBe("none");
      expect(status.connected).toBe(false);
    });
  });
});
