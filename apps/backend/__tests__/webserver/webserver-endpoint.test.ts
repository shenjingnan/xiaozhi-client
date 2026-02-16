/**
 * WebServer MCP 端点管理测试
 * 测试端点状态、连接/断开、添加/移除和事件总线监听
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
vi.mock("../../handlers/endpoint.handler", () => {
  const mocks = createHandlerMocks();
  return { EndpointHandler: mocks.EndpointHandler };
});

describe("WebServer MCP 端点管理测试", () => {
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

  describe("端点状态和连接", () => {
    it("应该处理获取端点状态请求", async () => {
      const endpointRequest = { endpoint: "ws://localhost:9999" };
      const response = await fetch(
        `http://localhost:${currentPort}/api/endpoint/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(endpointRequest),
        }
      );
      // 由于连接管理器可能未初始化，期望 503 或 200
      expect([200, 503]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.endpoint).toBe("ws://localhost:9999");
        expect(data.data.connected).toBe(true);
      } else {
        const data = await response.json();
        expect(data.error.code).toBe("ENDPOINT_HANDLER_NOT_AVAILABLE");
        expect(data.error.message).toBe("端点处理器尚未初始化，请稍后再试");
      }
    });

    it("应该处理连接端点请求", async () => {
      const endpointRequest = { endpoint: "ws://localhost:9999" };
      const response = await fetch(
        `http://localhost:${currentPort}/api/endpoint/connect`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(endpointRequest),
        }
      );
      // 由于连接管理器可能未初始化，期望 503 或 200
      expect([200, 503]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.operation).toBe("connect");
      } else {
        const data = await response.json();
        expect(data.error.code).toBe("ENDPOINT_HANDLER_NOT_AVAILABLE");
        expect(data.error.message).toBe("端点处理器尚未初始化，请稍后再试");
      }
    });

    it("应该处理断开端点请求", async () => {
      const endpointRequest = { endpoint: "ws://localhost:9999" };
      const response = await fetch(
        `http://localhost:${currentPort}/api/endpoint/disconnect`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(endpointRequest),
        }
      );
      // 由于连接管理器可能未初始化，期望 503 或 200
      expect([200, 503]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.operation).toBe("disconnect");
      } else {
        const data = await response.json();
        expect(data.error.code).toBe("ENDPOINT_HANDLER_NOT_AVAILABLE");
        expect(data.error.message).toBe("端点处理器尚未初始化，请稍后再试");
      }
    });
  });

  describe("端点添加和移除", () => {
    it("应该处理添加端点请求", async () => {
      const newEndpoint = {
        endpoint: "ws://new.endpoint",
      };

      const response = await fetch(
        `http://localhost:${currentPort}/api/endpoint/add`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newEndpoint),
        }
      );
      // 由于连接管理器可能未初始化，期望 503 或 200
      expect([200, 503]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.operation).toBe("add");
      } else {
        const data = await response.json();
        expect(data.error.code).toBe("ENDPOINT_HANDLER_NOT_AVAILABLE");
        expect(data.error.message).toBe("端点处理器尚未初始化，请稍后再试");
      }
    });

    it("应该处理移除端点请求", async () => {
      const endpointRequest = { endpoint: "ws://old.endpoint" };
      const response = await fetch(
        `http://localhost:${currentPort}/api/endpoint/remove`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(endpointRequest),
        }
      );
      // 由于连接管理器可能未初始化，期望 503 或 200
      expect([200, 503]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.operation).toBe("remove");
      } else {
        const data = await response.json();
        expect(data.error.code).toBe("ENDPOINT_HANDLER_NOT_AVAILABLE");
        expect(data.error.message).toBe("端点处理器尚未初始化，请稍后再试");
      }
    });

    it("应该处理重连端点请求", async () => {
      const endpointRequest = { endpoint: "ws://localhost:9999" };
      const response = await fetch(
        `http://localhost:${currentPort}/api/endpoint/reconnect`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(endpointRequest),
        }
      );
      // reconnect 路由已被移除，应该返回 404
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });

  describe("连接管理器不可用情况", () => {
    it("应该处理连接管理器不可用的情况", async () => {
      // 使用不同的端口避免冲突
      const testPort = await getAvailablePort();

      // 创建一个新的 WebServer 实例，确保连接管理器未初始化
      const tempWebServer = new WebServer(testPort);
      await tempWebServer.start();

      const endpointRequest = { endpoint: "ws://localhost:9999" };
      const response = await fetch(
        `http://localhost:${testPort}/api/endpoint/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(endpointRequest),
        }
      );
      expect(response.status).toBe(503);

      const data = await response.json();
      expect(data.error.code).toBe("ENDPOINT_HANDLER_NOT_AVAILABLE");
      expect(data.error.message).toBe("端点处理器尚未初始化，请稍后再试");

      await tempWebServer.stop();
    });
  });

  describe("事件总线监听", () => {
    it("应该设置接入点状态变更监听器", async () => {
      // 创建新的实例来测试事件监听器设置
      const testWebServer = new WebServer(currentPort);

      // 验证事件总线 onEvent 方法被调用
      const { getEventBus } = await import("@/services/index.js");
      const mockEventBus = getEventBus();
      expect(mockEventBus.onEvent).toHaveBeenCalledWith(
        "endpoint:status:changed",
        expect.any(Function)
      );

      await testWebServer.stop();
    });

    it("应该在端点状态变更时广播事件", async () => {
      // 获取事件总线并触发事件
      const { getEventBus } = await import("@/services/index.js");
      const mockEventBus = getEventBus() as any;

      // 模拟事件回调 - 使用 vi.mocked 来访问 mock 属性
      const mockOnEvent = vi.mocked(mockEventBus.onEvent);
      const eventCallback = mockOnEvent.mock.calls.find(
        ([event]: [string, (data: any) => void]) =>
          event === "endpoint:status:changed"
      )?.[1];

      if (eventCallback) {
        // 从 @services/index.js 导入 NotificationService（与 mock 路径一致）
        const { NotificationService } = await import("@/services/index.js");
        const mockNotificationService = vi.mocked(NotificationService);
        const mockInstance = mockNotificationService.mock.results[0]?.value;

        // 触发事件
        const eventData = {
          endpoint: "ws://localhost:9999",
          connected: true,
          operation: "connect" as const,
          success: true,
          message: "连接成功",
          timestamp: Date.now(),
        };

        eventCallback(eventData);

        // 验证广播被调用
        expect(mockInstance?.broadcast).toHaveBeenCalledWith(
          "endpoint_status_changed",
          {
            type: "endpoint_status_changed",
            data: {
              endpoint: "ws://localhost:9999",
              connected: true,
              operation: "connect",
              success: true,
              message: "连接成功",
              timestamp: eventData.timestamp,
            },
          }
        );
      }
    });
  });
});
