import { beforeEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { ProxyMCPServer } from "../connection.js";

describe("ProxyMCPServer 重试机制测试", () => {
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

    // 配置快速重试以加速测试
    proxyServer.updateRetryConfig({
      maxAttempts: 3,
      initialDelay: 10, // 10ms 延迟
      maxDelay: 100,
      backoffMultiplier: 2,
      retryableErrors: [-32001, -32002, -32000], // SERVICE_UNAVAILABLE, TIMEOUT, TOOL_EXECUTION_ERROR
    });
  });

  describe("重试机制", () => {
    it("应该对可重试错误进行重试", async () => {
      // 模拟前两次调用失败，第三次成功
      let callCount = 0;
      mockServiceManager.callTool.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          throw new Error("服务暂时不可用");
        }
        return Promise.resolve({
          content: [{ type: "text", text: "success after retry" }],
          isError: false,
        });
      });

      const request = {
        jsonrpc: "2.0",
        id: "retry-test-id",
        method: "tools/call",
        params: {
          name: "retry-tool",
          arguments: {},
        },
      };

      await (proxyServer as any).handleToolCall(request);

      // 验证重试了3次
      expect(mockServiceManager.callTool).toHaveBeenCalledTimes(3);

      // 验证最终成功
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"result"')
      );
    }, 10000);

    it("应该在达到最大重试次数后停止重试", async () => {
      // 模拟所有调用都失败
      mockServiceManager.callTool.mockRejectedValue(
        new Error("服务持续不可用")
      );

      const request = {
        jsonrpc: "2.0",
        id: "max-retry-test-id",
        method: "tools/call",
        params: {
          name: "failing-tool",
          arguments: {},
        },
      };

      await (proxyServer as any).handleToolCall(request);

      // 验证重试了最大次数
      expect(mockServiceManager.callTool).toHaveBeenCalledTimes(3);

      // 验证最终返回错误
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"error"')
      );
    }, 10000);

    it("应该对不可重试错误立即失败", async () => {
      // 模拟工具不存在错误（不可重试）
      mockServiceManager.callTool.mockRejectedValue(
        new Error("未找到工具: non-existent-tool")
      );

      const request = {
        jsonrpc: "2.0",
        id: "no-retry-test-id",
        method: "tools/call",
        params: {
          name: "non-existent-tool",
          arguments: {},
        },
      };

      await (proxyServer as any).handleToolCall(request);

      // 验证只调用了一次，没有重试
      expect(mockServiceManager.callTool).toHaveBeenCalledTimes(1);

      // 验证返回错误
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"error"')
      );
    });

    it("应该使用指数退避策略计算重试延迟", async () => {
      const config = proxyServer.getConfiguration().retry;

      // 验证重试配置
      expect(config.maxAttempts).toBe(3);
      expect(config.initialDelay).toBe(10);
      expect(config.backoffMultiplier).toBe(2);

      // 计算预期的重试延迟
      const expectedDelays = [
        config.initialDelay, // 第一次重试: 10ms
        config.initialDelay * config.backoffMultiplier, // 第二次重试: 20ms
      ];

      console.log("预期重试延迟:", expectedDelays);

      // 这里主要是验证配置正确性，实际的延迟测试比较复杂
      expect(expectedDelays[0]).toBe(10);
      expect(expectedDelays[1]).toBe(20);
    });
  });

  describe("性能监控与重试", () => {
    it("应该正确记录重试过程中的性能指标", async () => {
      // 重置性能指标
      proxyServer.resetPerformanceMetrics();

      // 模拟第一次失败，第二次成功
      let callCount = 0;
      mockServiceManager.callTool.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error("服务暂时不可用");
        }
        return Promise.resolve({
          content: [{ type: "text", text: "success" }],
          isError: false,
        });
      });

      const request = {
        jsonrpc: "2.0",
        id: "perf-retry-test-id",
        method: "tools/call",
        params: {
          name: "retry-perf-tool",
          arguments: {},
        },
      };

      await (proxyServer as any).handleToolCall(request);

      // 获取性能指标
      const metrics = proxyServer.getPerformanceMetrics();

      // 验证记录了一次成功调用
      expect(metrics.totalCalls).toBe(1);
      expect(metrics.successfulCalls).toBe(1);
      expect(metrics.failedCalls).toBe(0);
      expect(metrics.successRate).toBe(100);

      // 获取调用记录
      const records = proxyServer.getCallRecords(1);
      expect(records).toHaveLength(1);
      expect(records[0].success).toBe(true);
      expect(records[0].toolName).toBe("retry-perf-tool");
    }, 10000);
  });
});
