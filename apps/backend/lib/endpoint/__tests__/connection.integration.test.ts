import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { MCPMessage } from "@root/types/mcp.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProxyMCPServer } from "../connection.js";
import { createMockWebSocket, wait } from "./testHelpers.js";

// Mock WebSocket 接口（基于 testHelpers.ts 实现）
interface MockWebSocket {
  readyState: number;
  send: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  removeAllListeners: ReturnType<typeof vi.fn>;
  trigger: (event: string, ...args: unknown[]) => void;
  getListeners: () => Record<string, Array<(...args: unknown[]) => void>>;
}

// Mock Service Manager 接口（基于 IMCPServiceManager）
interface MockServiceManager {
  callTool: ReturnType<typeof vi.fn>;
  getAllTools: ReturnType<typeof vi.fn>;
}

// 类型安全的私有属性设置函数
function setPrivateProperty<T>(obj: T, prop: string, value: unknown): void {
  Object.defineProperty(obj, prop, {
    value,
    writable: true,
    configurable: true,
  });
}

// 测试专用的 ProxyMCPServer 设置函数
function setupTestProxyServer(
  proxyServer: ProxyMCPServer,
  mockWs: MockWebSocket
): void {
  // 类型安全地设置私有属性
  setPrivateProperty(proxyServer, "ws", mockWs);
  setPrivateProperty(proxyServer, "connectionStatus", true);
  setPrivateProperty(proxyServer, "serverInitialized", true);
  setPrivateProperty(proxyServer, "connectionState", "connected");
}

describe("ProxyMCPServer 集成测试", () => {
  let proxyServer: ProxyMCPServer;
  let mockServiceManager: MockServiceManager;
  let mockWs: MockWebSocket;

  const testTools: Tool[] = [
    {
      name: "echo-tool",
      description: "回显工具",
      inputSchema: {
        type: "object",
        properties: {
          message: { type: "string" },
        },
        required: ["message"],
      },
    },
    {
      name: "calc-tool",
      description: "计算工具",
      inputSchema: {
        type: "object",
        properties: {
          a: { type: "number" },
          b: { type: "number" },
          operation: { type: "string", enum: ["add", "subtract"] },
        },
        required: ["a", "b", "operation"],
      },
    },
  ];

  beforeEach(() => {
    mockWs = createMockWebSocket();

    mockServiceManager = {
      callTool: vi.fn(),
      getAllTools: vi.fn().mockReturnValue(testTools),
    };

    proxyServer = new ProxyMCPServer("ws://test-endpoint");
    proxyServer.setServiceManager(mockServiceManager);

    // 手动设置 WebSocket 监听器（模拟连接成功后的状态）
    proxyServer.connect = vi.fn().mockResolvedValue(undefined);
    setupTestProxyServer(proxyServer, mockWs);

    // 手动设置消息监听器
    mockWs.on("message", (data: Buffer | string) => {
      try {
        const message: MCPMessage = JSON.parse(data.toString());
        // 类型安全的私有方法调用
        (
          proxyServer as unknown as { handleMessage: (msg: MCPMessage) => void }
        ).handleMessage(message);
      } catch (error) {
        console.error("消息解析错误:", error);
      }
    });
  });

  describe("端到端工具调用流程", () => {
    it("应该完成完整的工具调用流程", async () => {
      const mockResponse = {
        content: [{ type: "text", text: "echo: hello world" }],
      };
      mockServiceManager.callTool.mockResolvedValue(mockResponse);

      const request = {
        jsonrpc: "2.0",
        id: "integration-1",
        method: "tools/call",
        params: {
          name: "echo-tool",
          arguments: { message: "hello world" },
        },
      };

      // 模拟接收到 WebSocket 消息
      mockWs.trigger("message", JSON.stringify(request));

      // 等待异步处理完成
      await wait(100);

      expect(mockServiceManager.callTool).toHaveBeenCalledWith("echo-tool", {
        message: "hello world",
      });

      const responseCall = mockWs.send.mock.calls[0][0];
      const response = JSON.parse(responseCall);
      expect(response.id).toBe("integration-1");
      expect(response.result.content).toEqual(mockResponse.content);
    });

    it("应该处理计算工具的完整流程", async () => {
      const mockResponse = {
        content: [{ type: "text", text: "15" }],
      };
      mockServiceManager.callTool.mockResolvedValue(mockResponse);

      const request = {
        jsonrpc: "2.0",
        id: "calc-1",
        method: "tools/call",
        params: {
          name: "calc-tool",
          arguments: { a: 10, b: 5, operation: "add" },
        },
      };

      // 模拟接收到 WebSocket 消息
      mockWs.trigger("message", JSON.stringify(request));

      // 等待异步处理完成
      await wait(100);

      expect(mockServiceManager.callTool).toHaveBeenCalledWith("calc-tool", {
        a: 10,
        b: 5,
        operation: "add",
      });

      const responseCall = mockWs.send.mock.calls[0][0];
      const response = JSON.parse(responseCall);
      expect(response.result.content[0].text).toBe("15");
    });
  });

  describe("并发调用（低并发场景）", () => {
    it("应该处理少量并发请求", async () => {
      const requests = [];
      const responses = [];

      // 模拟多个并发请求（降低到5个）
      for (let i = 0; i < 5; i++) {
        const response = {
          content: [{ type: "text", text: `response-${i}` }],
        };
        responses.push(response);
        mockServiceManager.callTool.mockResolvedValueOnce(response);

        requests.push({
          jsonrpc: "2.0",
          id: `concurrent-${i}`,
          method: "tools/call",
          params: {
            name: "echo-tool",
            arguments: { message: `message-${i}` },
          },
        });
      }

      // 并发执行所有请求
      await Promise.all(
        requests.map((request) => {
          mockWs.trigger("message", JSON.stringify(request));
          return wait(100);
        })
      );

      expect(mockServiceManager.callTool).toHaveBeenCalledTimes(5);
      expect(mockWs.send).toHaveBeenCalledTimes(5);

      // 验证每个响应
      const sentCalls = mockWs.send.mock.calls;
      for (let i = 0; i < 5; i++) {
        const responseCall = sentCalls.find((call) => {
          const response = JSON.parse(call[0]);
          return response.id === `concurrent-${i}`;
        });
        expect(responseCall).toBeDefined();
        const response = JSON.parse(responseCall?.[0] ?? "");
        expect(response.result.content[0].text).toBe(`response-${i}`);
      }
    });

    it("应该处理混合的并发请求类型", async () => {
      const listRequest = {
        jsonrpc: "2.0",
        id: "list-1",
        method: "tools/list",
      };

      const toolCallRequest = {
        jsonrpc: "2.0",
        id: "call-1",
        method: "tools/call",
        params: {
          name: "echo-tool",
          arguments: { message: "test" },
        },
      };

      mockServiceManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "echo: test" }],
      });

      // 并发执行不同类型的请求
      await Promise.all([
        new Promise((resolve) => {
          mockWs.trigger("message", JSON.stringify(listRequest));
          setTimeout(resolve, 100);
        }),
        new Promise((resolve) => {
          mockWs.trigger("message", JSON.stringify(toolCallRequest));
          setTimeout(resolve, 100);
        }),
      ]);

      expect(mockWs.send).toHaveBeenCalledTimes(2);
      expect(mockServiceManager.getAllTools).toHaveBeenCalled();
      expect(mockServiceManager.callTool).toHaveBeenCalled();
    });
  });

  describe("故障恢复", () => {
    it("应该从工具调用错误中恢复", async () => {
      const error1 = new Error("第一次失败");
      const error2 = new Error("第二次失败");
      const successResponse = {
        content: [{ type: "text", text: "成功" }],
      };

      mockServiceManager.callTool
        .mockRejectedValueOnce(error1)
        .mockRejectedValueOnce(error2)
        .mockResolvedValueOnce(successResponse);

      const requests = [
        {
          jsonrpc: "2.0",
          id: "fail-1",
          method: "tools/call",
          params: { name: "echo-tool", arguments: {} },
        },
        {
          jsonrpc: "2.0",
          id: "fail-2",
          method: "tools/call",
          params: { name: "echo-tool", arguments: {} },
        },
        {
          jsonrpc: "2.0",
          id: "success-1",
          method: "tools/call",
          params: { name: "echo-tool", arguments: {} },
        },
      ];

      for (const request of requests) {
        mockWs.trigger("message", JSON.stringify(request));
        await wait(100);
      }

      expect(mockServiceManager.callTool).toHaveBeenCalledTimes(3);
      expect(mockWs.send).toHaveBeenCalledTimes(3);

      // 验证错误响应
      const sentCalls = mockWs.send.mock.calls;
      const errorResponse1 = JSON.parse(sentCalls[0][0]);
      const errorResponse2 = JSON.parse(sentCalls[1][0]);
      const successResponse1 = JSON.parse(sentCalls[2][0]);

      expect(errorResponse1.error).toBeDefined();
      expect(errorResponse2.error).toBeDefined();
      expect(successResponse1.result).toBeDefined();
    });

    it("应该处理服务管理器临时不可用", async () => {
      mockServiceManager.callTool.mockImplementation(() => {
        throw new Error("服务不可用");
      });

      const request = {
        jsonrpc: "2.0",
        id: "unavailable",
        method: "tools/call",
        params: { name: "echo-tool", arguments: {} },
      };

      // 模拟接收到 WebSocket 消息
      mockWs.trigger("message", JSON.stringify(request));
      await wait(100);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"error"')
      );

      // 恢复服务
      mockServiceManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "已恢复" }],
      });

      mockWs.trigger(
        "message",
        JSON.stringify({
          ...request,
          id: "recovered",
        })
      );
      await wait(100);

      const sentCalls = mockWs.send.mock.calls;
      const responseCall = sentCalls[sentCalls.length - 1][0]; // 获取最后一个调用
      const response = JSON.parse(responseCall);
      expect(response.result).toBeDefined();
      expect(response.result.content[0].text).toBe("已恢复");
    });
  });

  describe("ID 类型处理（JSON-RPC 2.0 兼容性）", () => {
    beforeEach(() => {
      // 清理之前的调用记录
      mockWs.send.mockClear();
    });

    it("应该正确处理数字类型的请求 ID", async () => {
      mockServiceManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "数字 ID 响应" }],
      });

      const request = {
        jsonrpc: "2.0",
        id: 12345,
        method: "tools/call",
        params: { name: "echo-tool", arguments: {} },
      };

      // 模拟接收到 WebSocket 消息
      mockWs.trigger("message", JSON.stringify(request));
      await wait(100);

      expect(mockWs.send).toHaveBeenCalledTimes(1);
      const responseCall = mockWs.send.mock.calls[0][0];
      const response = JSON.parse(responseCall);
      expect(response.id).toBe(12345);
      expect(typeof response.id).toBe("number");
    });

    it("应该正确处理字符串类型的请求 ID", async () => {
      mockServiceManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "字符串 ID 响应" }],
      });

      const request = {
        jsonrpc: "2.0",
        id: "string-id-12345",
        method: "tools/call",
        params: { name: "echo-tool", arguments: {} },
      };

      // 模拟接收到 WebSocket 消息
      mockWs.trigger("message", JSON.stringify(request));
      await wait(100);

      expect(mockWs.send).toHaveBeenCalledTimes(1);
      const responseCall = mockWs.send.mock.calls[0][0];
      const response = JSON.parse(responseCall);
      expect(response.id).toBe("string-id-12345");
      expect(typeof response.id).toBe("string");
    });

    it("应该正确处理 0 作为有效的 ID", async () => {
      mockServiceManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "零 ID 响应" }],
      });

      const request = {
        jsonrpc: "2.0",
        id: 0,
        method: "tools/call",
        params: { name: "echo-tool", arguments: {} },
      };

      // 模拟接收到 WebSocket 消息
      mockWs.trigger("message", JSON.stringify(request));
      await wait(100);

      expect(mockWs.send).toHaveBeenCalledTimes(1);
      const responseCall = mockWs.send.mock.calls[0][0];
      const response = JSON.parse(responseCall);
      expect(response.id).toBe(0);
    });

    it("应该正确处理空字符串 ID", async () => {
      mockServiceManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "空 ID 响应" }],
      });

      const request = {
        jsonrpc: "2.0",
        id: "",
        method: "tools/call",
        params: { name: "echo-tool", arguments: {} },
      };

      // 模拟接收到 WebSocket 消息
      mockWs.trigger("message", JSON.stringify(request));
      await wait(100);

      expect(mockWs.send).toHaveBeenCalledTimes(1);
      const responseCall = mockWs.send.mock.calls[0][0];
      const response = JSON.parse(responseCall);
      expect(response.id).toBe("");
    });

    it("应该拒绝 undefined 和 null ID", async () => {
      // 注意：根据当前实现，没有 id 或 id 为 null 的请求不会发送响应
      // 这是设计决定，因为这些请求不符合 JSON-RPC 2.0 规范

      const undefinedRequest = {
        jsonrpc: "2.0",
        method: "tools/call",
        params: { name: "echo-tool", arguments: {} },
      };

      const nullRequest = {
        jsonrpc: "2.0",
        id: null,
        method: "tools/call",
        params: { name: "echo-tool", arguments: {} },
      };

      // 发送没有 id 的请求
      mockWs.trigger("message", JSON.stringify(undefinedRequest));
      await wait(100);

      // 发送 id 为 null 的请求
      mockWs.trigger("message", JSON.stringify(nullRequest));
      await wait(100);

      // 当前实现不会为这些无效请求发送响应
      expect(mockWs.send).toHaveBeenCalledTimes(0);
    });
  });

  describe("与现有系统的集成兼容性", () => {
    it("应该兼容旧版工具格式", async () => {
      const oldFormatTools = [
        {
          name: "old-tool",
          description: "旧格式工具",
          inputSchema: { type: "object", properties: {} }, // 需要提供有效的 inputSchema
        },
      ];

      mockServiceManager.getAllTools.mockReturnValue(oldFormatTools);

      const listRequest = {
        jsonrpc: "2.0",
        id: "old-format",
        method: "tools/list",
      };

      // 模拟接收到 WebSocket 消息
      mockWs.trigger("message", JSON.stringify(listRequest));
      await wait(100);

      expect(mockWs.send).toHaveBeenCalled();

      // 查找 tools/list 的响应
      const listResponse = mockWs.send.mock.calls.find((call) => {
        const response = JSON.parse(call[0]);
        return response.result?.tools;
      });

      expect(listResponse).toBeDefined();
      const response = JSON.parse(listResponse?.[0] ?? "");
      expect(response.result.tools).toBeDefined();
      expect(response.result.tools[0].name).toBe("old-tool");
    });

    it("应该处理特殊字符的参数", async () => {
      const specialChars = {
        message: "包含特殊字符: !@#$%^&*()中文测试",
        emoji: "🚀🔥💯",
      };

      mockServiceManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify(specialChars) }],
      });

      const request = {
        jsonrpc: "2.0",
        id: "special-chars",
        method: "tools/call",
        params: {
          name: "echo-tool",
          arguments: specialChars,
        },
      };

      // 模拟接收到 WebSocket 消息
      mockWs.trigger("message", JSON.stringify(request));
      await wait(100);

      expect(mockServiceManager.callTool).toHaveBeenCalledWith(
        "echo-tool",
        specialChars
      );
    });
  });
});
