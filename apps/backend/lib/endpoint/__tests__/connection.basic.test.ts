import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProxyMCPServer } from "../connection.js";
import { createMockWebSocket, wait } from "./testHelpers.js";

describe("ProxyMCPServer 基础功能测试", () => {
  let proxyServer: ProxyMCPServer;
  let mockServiceManager: any;
  let mockWs: any;

  beforeEach(() => {
    // 模拟 WebSocket
    mockWs = createMockWebSocket();

    // 模拟 MCPServiceManager
    mockServiceManager = {
      callTool: vi.fn(),
      getAllTools: vi.fn().mockReturnValue([
        {
          name: "test-tool",
          description: "测试工具",
          inputSchema: { type: "object", properties: {} },
        },
      ]),
    };

    proxyServer = new ProxyMCPServer("ws://test-endpoint");
    proxyServer.setServiceManager(mockServiceManager);

    // 手动设置 WebSocket 监听器（模拟连接成功后的状态）
    proxyServer.connect = vi.fn().mockResolvedValue();
    (proxyServer as any).ws = mockWs;
    (proxyServer as any).connectionStatus = true;
    (proxyServer as any).serverInitialized = true;
    (proxyServer as any).connectionState = "connected";

    // 手动设置消息监听器
    mockWs.on("message", (data: any) => {
      try {
        const message = JSON.parse(data.toString());
        (proxyServer as any).handleMessage(message);
      } catch (error) {
        console.error("消息解析错误:", error);
      }
    });
  });

  describe("连接管理", () => {
    it("应该正确初始化服务器", () => {
      expect(proxyServer).toBeDefined();
      expect((proxyServer as any).endpointUrl).toBe("ws://test-endpoint");
    });

    it("应该设置服务管理器", () => {
      expect((proxyServer as any).serviceManager).toBe(mockServiceManager);
    });

    it("应该正确处理连接状态", () => {
      expect(proxyServer.isConnected()).toBe(true);

      (proxyServer as any).connectionStatus = false;
      expect(proxyServer.isConnected()).toBe(false);
    });

    it("应该处理 URL 格式化", () => {
      const server1 = new ProxyMCPServer("ws://localhost:8080");
      expect((server1 as any).endpointUrl).toBe("ws://localhost:8080");

      const server2 = new ProxyMCPServer("http://localhost:8080");
      expect((server2 as any).endpointUrl).toBe("http://localhost:8080");
    });
  });

  describe("消息处理", () => {
    it("应该正确处理 ping 消息", async () => {
      const pingMessage = {
        jsonrpc: "2.0",
        id: "ping-1",
        method: "ping",
      };

      // 模拟接收到 WebSocket 消息
      mockWs.trigger("message", JSON.stringify(pingMessage));

      // 等待异步处理完成
      await wait(10);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringMatching(/\{"jsonrpc":"2\.0","id":"ping-1","result":\{\}\}/)
      );
    });

    it("应该正确处理 tools/list 请求", async () => {
      const listRequest = {
        jsonrpc: "2.0",
        id: "list-1",
        method: "tools/list",
      };

      // 模拟接收到 WebSocket 消息
      mockWs.trigger("message", JSON.stringify(listRequest));

      // 等待异步处理完成
      await wait(10);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"tools"')
      );
      expect(mockServiceManager.getAllTools).toHaveBeenCalled();
    });

    it("应该处理未知方法", async () => {
      const unknownRequest = {
        jsonrpc: "2.0",
        id: "unknown-1",
        method: "unknown/method",
      };

      // 模拟接收到 WebSocket 消息
      mockWs.trigger("message", JSON.stringify(unknownRequest));

      // 等待异步处理完成
      await wait(10);

      // 未知方法不会发送响应，只是记录警告日志
    });

    it("应该处理无效的 JSON-RPC 消息", async () => {
      const invalidMessage = {
        id: "invalid-1",
        // 缺少 jsonrpc 和 method
      };

      // 模拟接收到 WebSocket 消息
      mockWs.trigger("message", JSON.stringify(invalidMessage));

      // 等待异步处理完成
      await wait(10);

      // 无效消息不会发送响应，因为没有 method 字段
    });
  });

  describe("工具调用", () => {
    it("应该正确调用工具", async () => {
      const mockResponse = {
        content: [{ type: "text", text: "工具调用成功" }],
      };
      mockServiceManager.callTool.mockResolvedValue(mockResponse);

      const toolCallRequest = {
        jsonrpc: "2.0",
        id: "call-1",
        method: "tools/call",
        params: {
          name: "test-tool",
          arguments: { param1: "value1" },
        },
      };

      // 模拟接收到 WebSocket 消息
      mockWs.trigger("message", JSON.stringify(toolCallRequest));

      // 等待异步处理完成
      await wait(100);

      expect(mockServiceManager.callTool).toHaveBeenCalledWith("test-tool", {
        param1: "value1",
      });
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"content"')
      );
    });

    it("应该处理工具调用错误", async () => {
      const error = new Error("工具执行失败");
      mockServiceManager.callTool.mockRejectedValue(error);

      const toolCallRequest = {
        jsonrpc: "2.0",
        id: "call-error",
        method: "tools/call",
        params: {
          name: "test-tool",
          arguments: {},
        },
      };

      // 模拟接收到 WebSocket 消息
      mockWs.trigger("message", JSON.stringify(toolCallRequest));

      // 等待异步处理完成
      await wait(100);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"error"')
      );
    });

    it("应该处理不存在的工具", async () => {
      const toolCallRequest = {
        jsonrpc: "2.0",
        id: "call-missing",
        method: "tools/call",
        params: {
          name: "missing-tool",
          arguments: {},
        },
      };

      // 模拟接收到 WebSocket 消息
      mockWs.trigger("message", JSON.stringify(toolCallRequest));

      // 等待异步处理完成
      await wait(100);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"error"')
      );
    });
  });

  describe("错误处理", () => {
    it("应该正确处理普通错误", async () => {
      const error = new Error("测试错误");
      mockServiceManager.callTool.mockRejectedValue(error);

      const toolCallRequest = {
        jsonrpc: "2.0",
        id: "error-test",
        method: "tools/call",
        params: {
          name: "test-tool",
          arguments: {},
        },
      };

      // 模拟接收到 WebSocket 消息
      mockWs.trigger("message", JSON.stringify(toolCallRequest));

      // 等待异步处理完成
      await wait(100);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringMatching(/"error".*测试错误/)
      );
    });

    it("应该处理 null 错误", async () => {
      mockServiceManager.callTool.mockRejectedValue(null);

      const toolCallRequest = {
        jsonrpc: "2.0",
        id: "null-error",
        method: "tools/call",
        params: {
          name: "test-tool",
          arguments: {},
        },
      };

      // 模拟接收到 WebSocket 消息
      mockWs.trigger("message", JSON.stringify(toolCallRequest));

      // 等待异步处理完成
      await wait(100);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"error"')
      );
    });
  });

  describe("配置管理", () => {
    it("应该获取当前配置", () => {
      const config = proxyServer.getConfiguration();
      expect(config).toBeDefined();
      expect(config.toolCall).toBeDefined();
      expect(config.retry).toBeDefined();
      expect(config.toolCall.timeout).toBeGreaterThan(0);
    });

    it("应该更新工具调用配置", () => {
      const newConfig = { timeout: 60000, retryAttempts: 5 };
      proxyServer.updateToolCallConfig(newConfig);

      const config = proxyServer.getConfiguration();
      expect(config.toolCall.timeout).toBe(60000);
      expect(config.toolCall.retryAttempts).toBe(5);
    });

    it("应该更新重试配置", () => {
      const retryConfig = {
        maxAttempts: 5,
        initialDelay: 2000,
        maxDelay: 30000,
        backoffMultiplier: 2,
      };
      proxyServer.updateRetryConfig(retryConfig);

      // 通过内部 API 检查配置是否更新
      const internalRetryConfig = (proxyServer as any).retryConfig;
      expect(internalRetryConfig.maxAttempts).toBe(5);
      expect(internalRetryConfig.initialDelay).toBe(2000);
    });
  });

  describe("工具管理", () => {
    it("应该正确从服务管理器同步工具", () => {
      // 初始化时已经设置了服务管理器并同步了工具
      const syncedTools = proxyServer.getTools();
      expect(syncedTools).toHaveLength(1);
      expect(syncedTools[0].name).toBe("test-tool");
    });

    it("应该处理服务管理器未设置的情况", () => {
      const newProxyServer = new ProxyMCPServer("ws://test-endpoint");
      // 不设置服务管理器

      const syncedTools = newProxyServer.getTools();
      expect(syncedTools).toHaveLength(0);
    });

    it("应该添加和移除工具", () => {
      const newProxyServer = new ProxyMCPServer("ws://test-endpoint");

      // 添加工具
      newProxyServer.addTool("new-tool", {
        name: "new-tool",
        description: "新工具",
        inputSchema: {
          type: "object",
          properties: {},
        },
      });

      expect(newProxyServer.hasTool("new-tool")).toBe(true);

      // 移除工具
      newProxyServer.removeTool("new-tool");
      expect(newProxyServer.hasTool("new-tool")).toBe(false);
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