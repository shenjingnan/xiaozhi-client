import type { MCPMessage } from "@root/types/mcp.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type WebSocket from "ws";
import { EndpointConnection } from "../connection.js";
import { createMockWebSocket, wait } from "./testHelpers.js";
import type { MockServiceManager, MockWebSocket } from "./testTypes.js";
import {
  ConnectionState,
  getEndpointConnectionInternals,
} from "./testTypes.js";

describe("EndpointConnection 工具调用核心功能", () => {
  let endpointConnection: EndpointConnection;
  let mockServiceManager: MockServiceManager;
  let mockWs: MockWebSocket;

  beforeEach(() => {
    mockWs = createMockWebSocket();

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

    endpointConnection = new EndpointConnection("ws://test-endpoint");
    endpointConnection.setServiceManager(mockServiceManager);

    // 获取内部状态访问器
    const internals = getEndpointConnectionInternals(endpointConnection);

    // 手动设置 WebSocket 监听器（模拟连接成功后的状态）
    endpointConnection.connect = vi.fn().mockResolvedValue(undefined);
    internals.ws = mockWs as unknown as WebSocket;
    internals.connectionStatus = true;
    internals.serverInitialized = true;
    internals.connectionState = ConnectionState.CONNECTED;

    // 手动设置消息监听器
    mockWs.on("message", (data: string | Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as MCPMessage;
        internals.handleMessage(message);
      } catch (error) {
        console.error("消息解析错误:", error);
      }
    });
  });

  describe("工具调用执行", () => {
    it("应该成功调用工具并返回结果", async () => {
      const mockResult = {
        content: [{ type: "text", text: "success" }],
        isError: false,
      };
      mockServiceManager.callTool.mockResolvedValue(mockResult);

      const request = {
        jsonrpc: "2.0",
        id: "call-1",
        method: "tools/call",
        params: {
          name: "test-tool",
          arguments: { input: "test" },
        },
      };

      // 模拟接收到 WebSocket 消息
      mockWs.trigger("message", JSON.stringify(request));

      // 等待异步处理完成
      await wait(100);

      expect(mockServiceManager.callTool).toHaveBeenCalledWith("test-tool", {
        input: "test",
      });
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"result"')
      );
    });

    it("应该处理工具调用错误", async () => {
      const error = new Error("工具执行失败");
      mockServiceManager.callTool.mockRejectedValue(error);

      const request = {
        jsonrpc: "2.0",
        id: "call-error",
        method: "tools/call",
        params: {
          name: "test-tool",
          arguments: {},
        },
      };

      // 模拟接收到 WebSocket 消息
      mockWs.trigger("message", JSON.stringify(request));

      // 等待异步处理完成
      await wait(100);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"error"')
      );
    });

    it("应该处理不存在的工具", async () => {
      const request = {
        jsonrpc: "2.0",
        id: "call-missing",
        method: "tools/call",
        params: {
          name: "non-existent-tool",
          arguments: {},
        },
      };

      // 模拟接收到 WebSocket 消息
      mockWs.trigger("message", JSON.stringify(request));

      // 等待异步处理完成
      await wait(100);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"error"')
      );
    });
  });

  describe("超时处理", () => {
    it("应该在超时时间内返回结果", async () => {
      mockServiceManager.callTool.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({ content: [{ type: "text", text: "延迟响应" }] });
            }, 100);
          })
      );

      const request = {
        jsonrpc: "2.0",
        id: "timeout-test",
        method: "tools/call",
        params: {
          name: "test-tool",
          arguments: {},
        },
      };

      // 设置较短的超时时间
      const internals = getEndpointConnectionInternals(endpointConnection);
      internals.toolCallTimeout = 200;

      // 模拟接收到 WebSocket 消息
      const onMessageCallback = mockWs.on.mock.calls.find(
        (call: unknown[]) => Array.isArray(call) && call[0] === "message"
      )?.[1] as ((data: string) => void) | undefined;

      if (onMessageCallback) {
        onMessageCallback(JSON.stringify(request));

        // 等待异步处理完成
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      expect(mockServiceManager.callTool).toHaveBeenCalled();
    });
  });

  describe("特殊参数处理", () => {
    it("应该处理空对象参数", async () => {
      mockServiceManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "空参数处理" }],
      });

      const request = {
        jsonrpc: "2.0",
        id: "empty-args",
        method: "tools/call",
        params: {
          name: "test-tool",
          arguments: {},
        },
      };

      // 模拟接收到 WebSocket 消息
      mockWs.trigger("message", JSON.stringify(request));

      // 等待异步处理完成
      await wait(100);

      expect(mockServiceManager.callTool).toHaveBeenCalledWith("test-tool", {});
    });

    it("应该处理复杂对象参数", async () => {
      const complexArgs = {
        nested: {
          array: [1, 2, 3],
          object: { key: "value" },
        },
        special: "特殊字符测试",
      };

      mockServiceManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "复杂参数处理" }],
      });

      const request = {
        jsonrpc: "2.0",
        id: "complex-args",
        method: "tools/call",
        params: {
          name: "test-tool",
          arguments: complexArgs,
        },
      };

      // 模拟接收到 WebSocket 消息
      mockWs.trigger("message", JSON.stringify(request));

      // 等待异步处理完成
      await wait(100);

      expect(mockServiceManager.callTool).toHaveBeenCalledWith(
        "test-tool",
        complexArgs
      );
    });
  });
});
