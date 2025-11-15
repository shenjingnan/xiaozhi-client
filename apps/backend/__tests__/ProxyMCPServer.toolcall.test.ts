import { beforeEach, describe, expect, it, vi } from "vitest";
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
    (proxyServer as any).connectionStatus = true;
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

      // 临时设置较短的超时时间和禁用重试
      proxyServer.updateToolCallConfig({ timeout: 100 });
      proxyServer.updateRetryConfig({ maxAttempts: 1 });

      await (proxyServer as any).handleToolCall(request);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"error"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining("-32002")
      );
    }, 2000); // 增加测试超时时间
  });

  describe("性能监控", () => {
    it("应该正确记录成功调用的性能指标", async () => {
      const mockResult = {
        content: [{ type: "text", text: "success" }],
        isError: false,
      };

      mockServiceManager.callTool.mockResolvedValue(mockResult);

      const request = {
        jsonrpc: "2.0",
        id: "perf-test-id",
        method: "tools/call",
        params: {
          name: "test-tool",
          arguments: { input: "test" },
        },
      };

      await (proxyServer as any).handleToolCall(request);

      const metrics = proxyServer.getPerformanceMetrics();
      expect(metrics.totalCalls).toBe(1);
      expect(metrics.successfulCalls).toBe(1);
      expect(metrics.failedCalls).toBe(0);
      expect(metrics.successRate).toBe(100);
    });

    it("应该正确记录失败调用的性能指标", async () => {
      mockServiceManager.callTool.mockRejectedValue(new Error("工具执行失败"));

      const request = {
        jsonrpc: "2.0",
        id: "perf-fail-test-id",
        method: "tools/call",
        params: {
          name: "failing-tool",
          arguments: {},
        },
      };

      await (proxyServer as any).handleToolCall(request);

      const metrics = proxyServer.getPerformanceMetrics();
      expect(metrics.totalCalls).toBe(1);
      expect(metrics.successfulCalls).toBe(0);
      expect(metrics.failedCalls).toBe(1);
      expect(metrics.successRate).toBe(0);
    });

    it("应该能够获取调用记录", async () => {
      const mockResult = {
        content: [{ type: "text", text: "success" }],
        isError: false,
      };

      mockServiceManager.callTool.mockResolvedValue(mockResult);

      const request = {
        jsonrpc: "2.0",
        id: "record-test-id",
        method: "tools/call",
        params: {
          name: "test-tool",
          arguments: { input: "test" },
        },
      };

      await (proxyServer as any).handleToolCall(request);

      const records = proxyServer.getCallRecords(1);
      expect(records).toHaveLength(1);
      expect(records[0].id).toBe("record-test-id");
      expect(records[0].toolName).toBe("test-tool");
      expect(records[0].success).toBe(true);
      expect(records[0].duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe("配置管理", () => {
    it("应该能够更新工具调用配置", () => {
      const newConfig = {
        timeout: 60000,
        retryAttempts: 5,
      };

      proxyServer.updateToolCallConfig(newConfig);

      const config = proxyServer.getConfiguration();
      expect(config.toolCall.timeout).toBe(60000);
      expect(config.toolCall.retryAttempts).toBe(5);
    });

    it("应该能够更新重试配置", () => {
      const newRetryConfig = {
        maxAttempts: 5,
        initialDelay: 2000,
      };

      proxyServer.updateRetryConfig(newRetryConfig);

      const config = proxyServer.getConfiguration();
      expect(config.retry.maxAttempts).toBe(5);
      expect(config.retry.initialDelay).toBe(2000);
    });

    it("应该能够获取增强状态信息", () => {
      const status = proxyServer.getEnhancedStatus();

      expect(status).toHaveProperty("performance");
      expect(status).toHaveProperty("configuration");
      expect(status.performance).toHaveProperty("totalCalls");
      expect(status.configuration).toHaveProperty("toolCall");
      expect(status.configuration).toHaveProperty("retry");
    });
  });
});
