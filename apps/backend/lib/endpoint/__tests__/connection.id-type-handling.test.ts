import { beforeEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { ProxyMCPServer, ToolCallErrorCode } from "../connection.js";

describe("ProxyMCPServer ID 类型处理回归测试", () => {
  let proxyServer: ProxyMCPServer;
  let mockServiceManager: any;
  let mockWebSocket: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock WebSocket
    mockWebSocket = {
      readyState: WebSocket.OPEN,
      send: vi.fn(),
      on: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    // Mock ServiceManager
    mockServiceManager = {
      callTool: vi.fn(),
      getAllTools: vi.fn().mockReturnValue([]),
    };

    // Create ProxyMCPServer instance
    proxyServer = new ProxyMCPServer("ws://test.com");
    proxyServer.setServiceManager(mockServiceManager);

    // Set up the WebSocket connection manually for testing
    (proxyServer as any).ws = mockWebSocket;
    (proxyServer as any).connectionStatus = true;
  });

  describe("ID 类型保持测试", () => {
    it("应该保持 number 类型的 request.id", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 123, // number 类型
        method: "tools/call" as const,
        params: { name: "test-tool", arguments: {} },
      };

      mockServiceManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "success" }],
      });

      await (proxyServer as any).handleToolCall(request);

      // 验证 WebSocket.send 被调用
      expect(mockWebSocket.send).toHaveBeenCalledTimes(1);

      // 获取发送的消息
      const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0]);

      // 验证响应中的 id 保持为 number 类型
      expect(sentMessage.id).toBe(123);
      expect(typeof sentMessage.id).toBe("number");
      expect(sentMessage.jsonrpc).toBe("2.0");
      expect(sentMessage.result).toBeDefined();
    });

    it("应该保持 string 类型的 request.id", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: "test-string-id", // string 类型
        method: "tools/call" as const,
        params: { name: "test-tool", arguments: {} },
      };

      mockServiceManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "success" }],
      });

      await (proxyServer as any).handleToolCall(request);

      // 验证 WebSocket.send 被调用
      expect(mockWebSocket.send).toHaveBeenCalledTimes(1);

      // 获取发送的消息
      const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0]);

      // 验证响应中的 id 保持为 string 类型
      expect(sentMessage.id).toBe("test-string-id");
      expect(typeof sentMessage.id).toBe("string");
      expect(sentMessage.jsonrpc).toBe("2.0");
      expect(sentMessage.result).toBeDefined();
    });

    it("应该保持 0 作为有效的 number 类型 ID", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 0, // 0 是有效的 number ID
        method: "tools/call" as const,
        params: { name: "test-tool", arguments: {} },
      };

      mockServiceManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "success" }],
      });

      await (proxyServer as any).handleToolCall(request);

      // 验证 WebSocket.send 被调用
      expect(mockWebSocket.send).toHaveBeenCalledTimes(1);

      // 获取发送的消息
      const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0]);

      // 验证响应中的 id 保持为 0
      expect(sentMessage.id).toBe(0);
      expect(typeof sentMessage.id).toBe("number");
    });

    it("应该保持空字符串作为有效的 string 类型 ID", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: "", // 空字符串是有效的 string ID
        method: "tools/call" as const,
        params: { name: "test-tool", arguments: {} },
      };

      mockServiceManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "success" }],
      });

      await (proxyServer as any).handleToolCall(request);

      // 验证 WebSocket.send 被调用
      expect(mockWebSocket.send).toHaveBeenCalledTimes(1);

      // 获取发送的消息
      const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0]);

      // 验证响应中的 id 保持为空字符串
      expect(sentMessage.id).toBe("");
      expect(typeof sentMessage.id).toBe("string");
    });
  });

  describe("ID 验证测试", () => {
    it("当 request.id 为 undefined 时应该抛出 ToolCallError", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        // id: undefined, // 没有 id 字段
        method: "tools/call" as const,
        params: { name: "test-tool", arguments: {} },
      };

      await expect(
        (proxyServer as any).handleToolCall(request)
      ).rejects.toThrow("请求 ID 不能为空");

      // 验证错误码
      try {
        await (proxyServer as any).handleToolCall(request);
        expect.fail("应该抛出错误");
      } catch (error: any) {
        expect(error.message).toBe("请求 ID 不能为空");
        expect(error.code).toBe(ToolCallErrorCode.INVALID_PARAMS);
      }
    });

    it("当 request.id 为 null 时应该抛出 ToolCallError", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: null, // null ID
        method: "tools/call" as const,
        params: { name: "test-tool", arguments: {} },
      };

      await expect(
        (proxyServer as any).handleToolCall(request)
      ).rejects.toThrow("请求 ID 不能为空");

      // 验证错误码
      try {
        await (proxyServer as any).handleToolCall(request);
        expect.fail("应该抛出错误");
      } catch (error: any) {
        expect(error.message).toBe("请求 ID 不能为空");
        expect(error.code).toBe(ToolCallErrorCode.INVALID_PARAMS);
      }
    });
  });

  describe("工具调用完整流程测试", () => {
    it("应该完成 number 类型 ID 的完整 tools/call 流程", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 42,
        method: "tools/call" as const,
        params: {
          name: "calculator",
          arguments: { expression: "2+2" },
        },
      };

      const mockResult = {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, result: 4 }),
          },
        ],
        isError: false,
      };

      mockServiceManager.callTool.mockResolvedValue(mockResult);

      await (proxyServer as any).handleToolCall(request);

      // 验证工具调用
      expect(mockServiceManager.callTool).toHaveBeenCalledWith("calculator", {
        expression: "2+2",
      });

      // 验证响应发送
      expect(mockWebSocket.send).toHaveBeenCalledTimes(1);

      const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0]);

      // 验证 JSON-RPC 2.0 响应格式
      expect(sentMessage).toEqual({
        jsonrpc: "2.0",
        id: 42, // 保持 number 类型
        result: {
          content: mockResult.content,
          isError: false,
        },
      });
    });

    it("应该完成 string 类型 ID 的完整 tools/call 流程", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: "calc-request-001",
        method: "tools/call" as const,
        params: {
          name: "calculator",
          arguments: { expression: "5*5" },
        },
      };

      const mockResult = {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, result: 25 }),
          },
        ],
        isError: false,
      };

      mockServiceManager.callTool.mockResolvedValue(mockResult);

      await (proxyServer as any).handleToolCall(request);

      // 验证工具调用
      expect(mockServiceManager.callTool).toHaveBeenCalledWith("calculator", {
        expression: "5*5",
      });

      // 验证响应发送
      expect(mockWebSocket.send).toHaveBeenCalledTimes(1);

      const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0]);

      // 验证 JSON-RPC 2.0 响应格式
      expect(sentMessage).toEqual({
        jsonrpc: "2.0",
        id: "calc-request-001", // 保持 string 类型
        result: {
          content: mockResult.content,
          isError: false,
        },
      });
    });

    it("应该确保响应格式符合 JSON-RPC 2.0 规范", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 999,
        method: "tools/call" as const,
        params: { name: "test-tool", arguments: {} },
      };

      mockServiceManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "test result" }],
      });

      await (proxyServer as any).handleToolCall(request);

      const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0]);

      // 验证 JSON-RPC 2.0 必需字段
      expect(sentMessage.jsonrpc).toBe("2.0");
      expect(sentMessage.id).toBe(999);
      expect(sentMessage.result).toBeDefined();
      expect(sentMessage.error).toBeUndefined(); // 成功响应不应该有 error 字段

      // 验证 result 结构
      expect(sentMessage.result.content).toBeDefined();
      expect(sentMessage.result.isError).toBeDefined();
      expect(Array.isArray(sentMessage.result.content)).toBe(true);
    });
  });
});
