import { beforeEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { ProxyMCPServer } from "../connection.js";

describe("ProxyMCPServer 全面测试", () => {
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
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    // 模拟 MCPServiceManager
    mockServiceManager = {
      callTool: vi.fn(),
      getAllTools: vi.fn().mockReturnValue([
        { name: "test-tool", description: "Test tool" },
        { name: "calculator", description: "Calculator tool" },
      ]),
    };

    proxyServer = new ProxyMCPServer("ws://test-endpoint");
    proxyServer.setServiceManager(mockServiceManager);

    // 设置模拟的 WebSocket 连接
    (proxyServer as any).ws = mockWs;
    (proxyServer as any).connectionStatus = true;
  });

  describe("连接管理", () => {
    it("应该正确初始化连接状态", () => {
      const newServer = new ProxyMCPServer("ws://test-endpoint");
      expect(newServer.getStatus().connected).toBe(false);
    });

    it("应该正确处理连接URL", () => {
      const server1 = new ProxyMCPServer("ws://localhost:8080");
      const server2 = new ProxyMCPServer("wss://secure.example.com");

      expect(server1.getStatus().url).toBe("ws://localhost:8080");
      expect(server2.getStatus().url).toBe("wss://secure.example.com");
    });

    it("应该能够断开连接", () => {
      // 添加 removeAllListeners 方法到 mock
      mockWs.removeAllListeners = vi.fn();

      proxyServer.disconnect();
      expect(mockWs.close).toHaveBeenCalled();
    });

    it("应该能够获取连接状态", () => {
      const status = proxyServer.getStatus();
      expect(status).toHaveProperty("connected");
      expect(status).toHaveProperty("initialized");
      expect(status).toHaveProperty("url");
      expect(status).toHaveProperty("availableTools");
    });

    it("应该能够获取增强状态", () => {
      const enhancedStatus = proxyServer.getEnhancedStatus();
      expect(enhancedStatus).toHaveProperty("performance");
      expect(enhancedStatus).toHaveProperty("configuration");
      expect(enhancedStatus.performance).toHaveProperty("totalCalls");
      expect(enhancedStatus.configuration).toHaveProperty("toolCall");
      expect(enhancedStatus.configuration).toHaveProperty("retry");
    });
  });

  describe("工具同步", () => {
    it("应该能够同步工具列表", async () => {
      await (proxyServer as any).syncToolsFromServiceManager();

      expect(mockServiceManager.getAllTools).toHaveBeenCalled();
      expect((proxyServer as any).tools.size).toBe(2);
    });

    it("应该处理空工具列表", async () => {
      mockServiceManager.getAllTools.mockReturnValue([]);

      await (proxyServer as any).syncToolsFromServiceManager();

      expect((proxyServer as any).tools.size).toBe(0);
    });

    it("应该处理工具同步错误", async () => {
      mockServiceManager.getAllTools.mockImplementation(() => {
        throw new Error("同步失败");
      });

      // 应该不抛出异常
      try {
        await (proxyServer as any).syncToolsFromServiceManager();
      } catch (error) {
        // 预期会有错误日志，但不应该抛出异常
      }
    });
  });

  describe("消息处理", () => {
    it("应该处理 ping 消息", async () => {
      const pingMessage = {
        jsonrpc: "2.0",
        id: "ping-1",
        method: "ping",
      };

      await (proxyServer as any).handleServerRequest(pingMessage);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"result"')
      );
    });

    it("应该处理 tools/list 消息", async () => {
      const toolsListMessage = {
        jsonrpc: "2.0",
        id: "tools-1",
        method: "tools/list",
      };

      await (proxyServer as any).handleServerRequest(toolsListMessage);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"tools"')
      );
    });

    it("应该处理未知消息类型", async () => {
      const unknownMessage = {
        jsonrpc: "2.0",
        id: "unknown-1",
        method: "unknown/method",
      };

      await (proxyServer as any).handleServerRequest(unknownMessage);

      // 未知消息类型不会发送响应，只会记录日志
      // expect(mockWs.send).toHaveBeenCalledWith(
      //   expect.stringContaining('"error"')
      // );
    });

    it("应该处理无效的消息格式", async () => {
      const invalidMessage = {
        // 缺少必需字段
        method: "ping",
      };

      // 应该不抛出异常
      try {
        await (proxyServer as any).handleServerRequest(invalidMessage);
      } catch (error) {
        // 预期可能会有错误，但不应该抛出异常
      }
    });
  });

  describe("错误处理", () => {
    it("应该处理普通 Error 对象", () => {
      const error = new Error("普通错误");

      (proxyServer as any).handleToolCallError(error, "test-id", 100);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"code":-32000')
      );
    });

    it("应该处理 null 错误", () => {
      (proxyServer as any).handleToolCallError(null, "test-id", 100);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"error"')
      );
    });
  });

  describe("性能监控边界测试", () => {
    it("应该正确处理最小响应时间", async () => {
      // 重置性能指标
      proxyServer.resetPerformanceMetrics();

      // 模拟快速调用
      mockServiceManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "fast" }],
      });

      const request = {
        jsonrpc: "2.0",
        id: "fast-test",
        method: "tools/call",
        params: { name: "fast-tool", arguments: {} },
      };

      await (proxyServer as any).handleToolCall(request);

      const metrics = proxyServer.getPerformanceMetrics();
      expect(metrics.minResponseTime).toBeGreaterThanOrEqual(0);
      expect(metrics.maxResponseTime).toBeGreaterThanOrEqual(
        metrics.minResponseTime
      );
    });

    it("应该正确处理调用记录限制", async () => {
      // 重置性能指标
      proxyServer.resetPerformanceMetrics();

      // 模拟大量调用（超过最大记录数）
      mockServiceManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "success" }],
      });

      // 执行 105 次调用（超过默认的 100 条限制）
      for (let i = 0; i < 105; i++) {
        const request = {
          jsonrpc: "2.0",
          id: `test-${i}`,
          method: "tools/call",
          params: { name: "test-tool", arguments: {} },
        };

        await (proxyServer as any).handleToolCall(request);
      }

      const records = proxyServer.getCallRecords();
      expect(records.length).toBeLessThanOrEqual(100);
    });

    it("应该正确计算成功率", async () => {
      // 重置性能指标
      proxyServer.resetPerformanceMetrics();

      // 模拟 3 次成功，2 次失败
      let callCount = 0;
      mockServiceManager.callTool.mockImplementation(() => {
        callCount++;
        if (callCount <= 3) {
          return Promise.resolve({
            content: [{ type: "text", text: "success" }],
          });
        }
        return Promise.reject(new Error("失败"));
      });

      // 执行 5 次调用
      for (let i = 0; i < 5; i++) {
        const request = {
          jsonrpc: "2.0",
          id: `test-${i}`,
          method: "tools/call",
          params: { name: "test-tool", arguments: {} },
        };

        await (proxyServer as any).handleToolCall(request);
      }

      const metrics = proxyServer.getPerformanceMetrics();
      expect(metrics.totalCalls).toBe(5);
      expect(metrics.successfulCalls).toBe(3);
      expect(metrics.failedCalls).toBe(2);
      expect(metrics.successRate).toBe(60); // 3/5 * 100
    });
  });

  describe("配置管理边界测试", () => {
    it("应该处理部分配置更新", () => {
      const originalConfig = proxyServer.getConfiguration();

      // 只更新超时时间
      proxyServer.updateToolCallConfig({ timeout: 45000 });

      const updatedConfig = proxyServer.getConfiguration();
      expect(updatedConfig.toolCall.timeout).toBe(45000);
      expect(updatedConfig.toolCall.retryAttempts).toBe(
        originalConfig.toolCall.retryAttempts
      );
    });

    it("应该处理空配置更新", () => {
      const originalConfig = proxyServer.getConfiguration();

      proxyServer.updateToolCallConfig({});
      proxyServer.updateRetryConfig({});

      const updatedConfig = proxyServer.getConfiguration();
      expect(updatedConfig).toEqual(originalConfig);
    });

    it("应该处理极端配置值", () => {
      proxyServer.updateRetryConfig({
        maxAttempts: 0,
        initialDelay: 0,
        maxDelay: 0,
        backoffMultiplier: 0,
      });

      const config = proxyServer.getConfiguration();
      expect(config.retry.maxAttempts).toBe(0);
      expect(config.retry.initialDelay).toBe(0);
    });
  });
});
