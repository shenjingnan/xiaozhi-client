import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { ProxyMCPServer } from "../ProxyMCPServer.js";

describe("ProxyMCPServer 工具调用功能", () => {
  let proxyServer: ProxyMCPServer;
  let mockServiceManager: any;
  let mockWs: any;

  beforeEach(() => {
    // 模拟 WebSocket
    mockWs = {
      readyState: WebSocket.OPEN,
      send: vi.fn(),
      on: vi.fn(),
      close: vi.fn(),
    };

    // 模拟 MCPServiceManager
    mockServiceManager = {
      callTool: vi.fn(),
      getAllTools: vi.fn().mockReturnValue([]),
    };

    proxyServer = new ProxyMCPServer("ws://test-endpoint");
    proxyServer.setServiceManager(mockServiceManager);

    // 设置模拟的 WebSocket 连接
    (proxyServer as any).ws = mockWs;
    (proxyServer as any).isConnected = true;
  });

  describe("参数验证", () => {
    it("应该接受有效的工具调用参数", () => {
      const params = {
        name: "test-tool",
        arguments: { key: "value" },
      };

      expect(() => {
        (proxyServer as any).validateToolCallParams(params);
      }).not.toThrow();
    });

    it("应该拒绝空的工具名称", () => {
      const params = {
        name: "",
        arguments: {},
      };

      expect(() => {
        (proxyServer as any).validateToolCallParams(params);
      }).toThrow("工具名称必须是非空字符串");
    });

    it("应该拒绝无效的参数格式", () => {
      const params = {
        name: "test-tool",
        arguments: "invalid",
      };

      expect(() => {
        (proxyServer as any).validateToolCallParams(params);
      }).toThrow("工具参数必须是对象");
    });

    it("应该拒绝空参数", () => {
      expect(() => {
        (proxyServer as any).validateToolCallParams(null);
      }).toThrow("请求参数必须是对象");
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
        id: "test-id",
        method: "tools/call",
        params: {
          name: "test-tool",
          arguments: { input: "test" },
        },
      };

      await (proxyServer as any).handleToolCall(request);

      expect(mockServiceManager.callTool).toHaveBeenCalledWith("test-tool", {
        input: "test",
      });
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"result"')
      );
    });

    it("应该处理工具不存在的错误", async () => {
      mockServiceManager.callTool.mockRejectedValue(
        new Error("未找到工具: test-tool")
      );

      const request = {
        jsonrpc: "2.0",
        id: "test-id",
        method: "tools/call",
        params: {
          name: "test-tool",
          arguments: {},
        },
      };

      await (proxyServer as any).handleToolCall(request);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"error"')
      );
    });

    it("应该处理服务管理器未设置的错误", async () => {
      // 清除服务管理器
      (proxyServer as any).serviceManager = null;

      const request = {
        jsonrpc: "2.0",
        id: "test-id",
        method: "tools/call",
        params: {
          name: "test-tool",
          arguments: {},
        },
      };

      await (proxyServer as any).handleToolCall(request);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"error"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining("-32001")
      );
    });
  });

  describe("超时处理", () => {
    it("应该在超时时返回错误", async () => {
      // 模拟一个永远不会resolve的Promise
      mockServiceManager.callTool.mockImplementation(
        () => new Promise(() => {}) // 永远不会resolve
      );

      const request = {
        jsonrpc: "2.0",
        id: "test-id",
        method: "tools/call",
        params: {
          name: "slow-tool",
          arguments: {},
        },
      };

      // 使用较短的超时时间进行测试
      const originalExecute = (proxyServer as any).executeToolWithTimeout;
      (proxyServer as any).executeToolWithTimeout = function (
        sm: any,
        name: string,
        args: any
      ) {
        return originalExecute.call(this, sm, name, args, 100); // 100ms 超时
      };

      await (proxyServer as any).handleToolCall(request);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"error"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining("-32002")
      );
    }, 1000); // 测试超时时间设为1秒
  });
});
