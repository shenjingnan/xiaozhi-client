import type { MCPMessage } from "@root/types/mcp.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Data } from "ws";
import type WebSocket from "ws";
import { EndpointConnection } from "../connection.js";
import { createMockWebSocket, wait } from "./testHelpers.js";
import type {
  MockServiceManager,
  MockWebSocket,
  ToolCallParams,
} from "./testTypes.js";
import {
  ConnectionState,
  getEndpointConnectionInternals,
} from "./testTypes.js";

describe("EndpointConnection 基础功能测试", () => {
  let endpointConnection: EndpointConnection;
  let mockServiceManager: MockServiceManager;
  let mockWs: MockWebSocket;

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

    endpointConnection = new EndpointConnection("ws://test-endpoint");
    endpointConnection.setServiceManager(mockServiceManager);

    // 手动设置 WebSocket 监听器（模拟连接成功后的状态）
    endpointConnection.connect = vi.fn().mockResolvedValue(undefined);

    // 使用类型安全的内部状态访问器
    const internals = getEndpointConnectionInternals(endpointConnection);
    internals.ws = mockWs as unknown as WebSocket;
    internals.connectionStatus = true;
    internals.serverInitialized = true;
    internals.connectionState = ConnectionState.CONNECTED;

    // 手动设置消息监听器
    mockWs.on("message", (data: Data) => {
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
        internals.handleMessage(message);
      } catch (error) {
        console.error("消息解析错误:", error);
      }
    });
  });

  describe("连接管理", () => {
    it("应该正确初始化服务器", () => {
      expect(endpointConnection).toBeDefined();
      const internals = getEndpointConnectionInternals(endpointConnection);
      expect(internals.endpointUrl).toBe("ws://test-endpoint");
    });

    it("应该设置服务管理器", () => {
      const internals = getEndpointConnectionInternals(endpointConnection);
      expect(internals.serviceManager).toBe(mockServiceManager);
    });

    it("应该正确处理连接状态", () => {
      expect(endpointConnection.isConnected()).toBe(true);

      const internals = getEndpointConnectionInternals(endpointConnection);
      internals.connectionStatus = false;
      expect(endpointConnection.isConnected()).toBe(false);
    });

    it("应该处理 URL 格式化", () => {
      const server1 = new EndpointConnection("ws://localhost:8080");
      const internals1 = getEndpointConnectionInternals(server1);
      expect(internals1.endpointUrl).toBe("ws://localhost:8080");

      const server2 = new EndpointConnection("http://localhost:8080");
      const internals2 = getEndpointConnectionInternals(server2);
      expect(internals2.endpointUrl).toBe("http://localhost:8080");
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
        expect.stringMatching(
          /\{"jsonrpc":"2\.0","id":"ping-1","result":\{\}\}/
        )
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

      const toolCallParams: ToolCallParams = {
        name: "test-tool",
        arguments: { param1: "value1" },
      };

      const toolCallRequest = {
        jsonrpc: "2.0" as const,
        id: "call-1",
        method: "tools/call",
        params: toolCallParams,
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
      // 模拟工具不存在的情况，返回 rejected Promise
      mockServiceManager.callTool.mockRejectedValue(new Error("未找到工具"));

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

  describe("工具管理", () => {
    it("应该正确从服务管理器同步工具", () => {
      // 初始化时已经设置了服务管理器并同步了工具
      const syncedTools = endpointConnection.getTools();
      expect(syncedTools).toHaveLength(1);
      expect(syncedTools[0].name).toBe("test-tool");
    });

    it("应该处理服务管理器未设置的情况", () => {
      const newEndpointConnection = new EndpointConnection(
        "ws://test-endpoint"
      );
      // 不设置服务管理器

      const syncedTools = newEndpointConnection.getTools();
      expect(syncedTools).toHaveLength(0);
    });

    it("应该直接从服务管理器获取工具", () => {
      const newEndpointConnection = new EndpointConnection(
        "ws://test-endpoint"
      );

      // 设置服务管理器
      newEndpointConnection.setServiceManager(mockServiceManager);

      // 获取工具应该直接从服务管理器获取
      const tools = newEndpointConnection.getTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe("test-tool");
      expect(tools[0].description).toBe("测试工具");
    });
  });

  describe("断开连接", () => {
    it("应该正确断开连接", () => {
      endpointConnection.disconnect();

      expect(mockWs.close).toHaveBeenCalled();
      expect(endpointConnection.isConnected()).toBe(false);
    });

    it("应该处理断开连接时的错误", () => {
      mockWs.close.mockImplementation(() => {
        throw new Error("断开失败");
      });

      // 不应该抛出错误
      expect(() => endpointConnection.disconnect()).not.toThrow();
    });
  });
});
