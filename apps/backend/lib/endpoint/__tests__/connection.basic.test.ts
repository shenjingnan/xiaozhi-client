import type { MCPMessage } from "@root/types/mcp.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Data } from "ws";
import type WebSocket from "ws";
import { ProxyMCPServer } from "../connection.js";
import { createMockWebSocket, wait } from "./testHelpers.js";
import type { MockServiceManager, MockWebSocket } from "./testTypes.js";
import { ConnectionState, getProxyServerInternals } from "./testTypes.js";

describe("ProxyMCPServer 基础功能测试", () => {
  let proxyServer: ProxyMCPServer;
  let mockServiceManager: MockServiceManager;
  let mockWs: MockWebSocket;

  beforeEach(() => {
    // 模拟 WebSocket
    mockWs = createMockWebSocket();

    // 模拟 MCPServiceManager - 使用 Partial 因为我们只需要 routeMessage 方法
    mockServiceManager = {
      routeMessage: vi.fn().mockResolvedValue(null),
    } as any;

    proxyServer = new ProxyMCPServer("ws://test-endpoint");
    proxyServer.setServiceManager(mockServiceManager);

    // 手动设置 WebSocket 监听器（模拟连接成功后的状态）
    proxyServer.connect = vi.fn().mockResolvedValue(undefined);

    // 使用类型安全的内部状态访问器
    const internals = getProxyServerInternals(proxyServer);
    internals.ws = mockWs as unknown as WebSocket;
    internals.connectionStatus = true;
    internals.connectionState = ConnectionState.CONNECTED;

    // 手动设置消息监听器
    mockWs.on("message", async (data: Data) => {
      try {
        let dataString: string;

        if (Buffer.isBuffer(data)) {
          dataString = data.toString("utf8");
        } else if (typeof data === "string") {
          dataString = data;
        } else if (ArrayBuffer.isView(data)) {
          dataString = Buffer.from(
            data.buffer,
            data.byteOffset,
            data.byteLength
          ).toString("utf8");
        } else if (data instanceof ArrayBuffer) {
          dataString = Buffer.from(data).toString("utf8");
        } else {
          dataString = String(data);
        }

        const message = JSON.parse(dataString) as MCPMessage;
        await internals.handleMessage(message);
      } catch (error) {
        console.error("消息解析错误:", error);
      }
    });
  });

  describe("连接管理", () => {
    it("应该正确初始化服务器", () => {
      expect(proxyServer).toBeDefined();
      const internals = getProxyServerInternals(proxyServer);
      expect(internals.endpointUrl).toBe("ws://test-endpoint");
    });

    it("应该设置服务管理器", () => {
      const internals = getProxyServerInternals(proxyServer);
      expect(internals.serviceManager).toBe(mockServiceManager);
    });

    it("应该正确处理连接状态", () => {
      expect(proxyServer.isConnected()).toBe(true);

      const internals = getProxyServerInternals(proxyServer);
      internals.connectionStatus = false;
      expect(proxyServer.isConnected()).toBe(false);
    });

    it("应该处理 URL 格式化", () => {
      const server1 = new ProxyMCPServer("ws://localhost:8080");
      const internals1 = getProxyServerInternals(server1);
      expect(internals1.endpointUrl).toBe("ws://localhost:8080");

      const server2 = new ProxyMCPServer("http://localhost:8080");
      const internals2 = getProxyServerInternals(server2);
      expect(internals2.endpointUrl).toBe("http://localhost:8080");
    });
  });

  describe("消息处理", () => {
    it("应该将消息转发给 MCPServiceManager", async () => {
      const testMessage = {
        jsonrpc: "2.0",
        id: "test-1",
        method: "tools/list",
      };

      // 模拟 MCPServiceManager 的响应
      const mockResponse = {
        jsonrpc: "2.0",
        id: "test-1",
        result: { tools: [] },
      };
      mockServiceManager.routeMessage.mockResolvedValue(mockResponse);

      // 模拟接收到 WebSocket 消息
      mockWs.trigger("message", JSON.stringify(testMessage));

      // 等待异步处理完成
      await wait(10);

      // 验证消息被转发给 MCPServiceManager
      expect(mockServiceManager.routeMessage).toHaveBeenCalledWith(testMessage);

      // 验证响应被发送回客户端
      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify(mockResponse));
    });

    it("应该处理没有响应的消息", async () => {
      const notificationMessage = {
        jsonrpc: "2.0",
        method: "notifications/initialized",
      };

      // 模拟 MCPServiceManager 返回 null（通知消息不需要响应）
      mockServiceManager.routeMessage.mockResolvedValue(null);

      // 模拟接收到 WebSocket 消息
      mockWs.trigger("message", JSON.stringify(notificationMessage));

      // 等待异步处理完成
      await wait(10);

      // 验证消息被转发给 MCPServiceManager
      expect(mockServiceManager.routeMessage).toHaveBeenCalledWith(
        notificationMessage
      );

      // 验证没有发送响应
      expect(mockWs.send).not.toHaveBeenCalled();
    });

    it("应该处理没有 serviceManager 的情况", async () => {
      // 移除 serviceManager
      const internals = getProxyServerInternals(proxyServer);
      internals.serviceManager = null;

      const testMessage = {
        jsonrpc: "2.0",
        id: "test-1",
        method: "tools/list",
      };

      // 模拟接收到 WebSocket 消息
      mockWs.trigger("message", JSON.stringify(testMessage));

      // 等待异步处理完成
      await wait(10);

      // 验证没有发送响应
      expect(mockWs.send).not.toHaveBeenCalled();
    });

    it("应该处理 serviceManager 抛出错误的情况", async () => {
      const testMessage = {
        jsonrpc: "2.0",
        id: "test-1",
        method: "tools/list",
      };

      // 模拟 serviceManager 抛出错误
      mockServiceManager.routeMessage.mockRejectedValue(new Error("处理失败"));

      // 模拟接收到 WebSocket 消息
      mockWs.trigger("message", JSON.stringify(testMessage));

      // 等待异步处理完成
      await wait(10);

      // 验证没有发送响应（错误被捕获并记录）
      expect(mockWs.send).not.toHaveBeenCalled();
    });
  });

  describe("断开连接", () => {
    it("应该正确断开连接", () => {
      proxyServer.disconnect();

      expect(mockWs.close).toHaveBeenCalled();
      expect(proxyServer.isConnected()).toBe(false);
    });

    it("应该处理断开连接时的错误", () => {
      mockWs.close.mockImplementation(() => {
        throw new Error("断开失败");
      });

      // 不应该抛出错误
      expect(() => proxyServer.disconnect()).not.toThrow();
    });
  });
});
