import { beforeEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { ProxyMCPServer } from "../ProxyMCPServer.js";

describe("ProxyMCPServer 性能测试", () => {
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
      removeAllListeners: vi.fn(),
    };

    // 模拟 MCPServiceManager
    mockServiceManager = {
      callTool: vi.fn(),
      getAllTools: vi.fn().mockReturnValue([
        {
          name: "fast-tool",
          description: "快速工具",
          inputSchema: { type: "object" },
        },
      ]),
    };

    proxyServer = new ProxyMCPServer("ws://test-endpoint");
    proxyServer.setServiceManager(mockServiceManager);

    // 设置模拟的 WebSocket 连接
    (proxyServer as any).ws = mockWs;
    (proxyServer as any).isConnected = true;
  });

  describe("响应时间性能", () => {
    it("应该在 100ms 内完成单个工具调用", async () => {
      // 模拟快速响应的工具
      mockServiceManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "快速响应" }],
      });

      const request = {
        jsonrpc: "2.0",
        id: "perf-test-1",
        method: "tools/call",
        params: {
          name: "fast-tool",
          arguments: {},
        },
      };

      const startTime = Date.now();
      await (proxyServer as any).handleToolCall(request);
      const duration = Date.now() - startTime;

      // 验证响应时间 < 100ms
      expect(duration).toBeLessThan(100);

      // 验证性能指标记录
      const metrics = proxyServer.getPerformanceMetrics();
      expect(metrics.totalCalls).toBe(1);
      expect(metrics.averageResponseTime).toBeLessThan(100);
    });

    it("应该正确计算平均响应时间", async () => {
      // 重置性能指标
      proxyServer.resetPerformanceMetrics();

      // 模拟不同响应时间的调用
      const responseTimes = [10, 20, 30, 40, 50]; // 平均 30ms
      let callIndex = 0;

      mockServiceManager.callTool.mockImplementation(() => {
        const delay = responseTimes[callIndex++];
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              content: [{ type: "text", text: `响应 ${callIndex}` }],
            });
          }, delay);
        });
      });

      // 执行多次调用
      const requests = responseTimes.map((_, index) => ({
        jsonrpc: "2.0",
        id: `perf-test-${index}`,
        method: "tools/call",
        params: {
          name: "fast-tool",
          arguments: {},
        },
      }));

      // 并发执行所有请求
      await Promise.all(
        requests.map((request) => (proxyServer as any).handleToolCall(request))
      );

      // 验证平均响应时间
      const metrics = proxyServer.getPerformanceMetrics();
      expect(metrics.totalCalls).toBe(5);
      expect(metrics.averageResponseTime).toBeGreaterThan(20);
      expect(metrics.averageResponseTime).toBeLessThan(40);
    });
  });

  describe("并发处理能力", () => {
    it("应该能够处理 100 个并发请求", async () => {
      // 重置性能指标
      proxyServer.resetPerformanceMetrics();

      // 模拟快速响应
      mockServiceManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "并发响应" }],
      });

      // 创建 100 个并发请求
      const concurrentRequests = Array.from({ length: 100 }, (_, index) => ({
        jsonrpc: "2.0",
        id: `concurrent-${index}`,
        method: "tools/call",
        params: {
          name: "fast-tool",
          arguments: { index },
        },
      }));

      const startTime = Date.now();

      // 并发执行所有请求
      await Promise.all(
        concurrentRequests.map((request) =>
          (proxyServer as any).handleToolCall(request)
        )
      );

      const totalDuration = Date.now() - startTime;

      // 验证所有请求都被处理
      expect(mockServiceManager.callTool).toHaveBeenCalledTimes(100);

      // 验证性能指标
      const metrics = proxyServer.getPerformanceMetrics();
      expect(metrics.totalCalls).toBe(100);
      expect(metrics.successfulCalls).toBe(100);

      // 验证并发处理能力 (QPS > 100)
      const qps = (100 / totalDuration) * 1000;
      expect(qps).toBeGreaterThan(100);

      console.log(`并发测试结果: ${qps.toFixed(2)} QPS`);
    });

    it("应该在高并发下保持稳定的性能", async () => {
      // 重置性能指标
      proxyServer.resetPerformanceMetrics();

      // 模拟轻微延迟的响应
      mockServiceManager.callTool.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              content: [{ type: "text", text: "稳定响应" }],
            });
          }, Math.random() * 10); // 0-10ms 随机延迟
        });
      });

      // 分批执行请求以模拟持续负载
      const batchSize = 20;
      const batchCount = 5;
      const results: number[] = [];

      for (let batch = 0; batch < batchCount; batch++) {
        const batchRequests = Array.from({ length: batchSize }, (_, index) => ({
          jsonrpc: "2.0",
          id: `batch-${batch}-${index}`,
          method: "tools/call",
          params: {
            name: "fast-tool",
            arguments: { batch, index },
          },
        }));

        const batchStartTime = Date.now();

        await Promise.all(
          batchRequests.map((request) =>
            (proxyServer as any).handleToolCall(request)
          )
        );

        const batchDuration = Date.now() - batchStartTime;
        const batchQps = (batchSize / batchDuration) * 1000;
        results.push(batchQps);

        console.log(`批次 ${batch + 1} QPS: ${batchQps.toFixed(2)}`);
      }

      // 验证性能稳定性（标准差应该较小）
      const avgQps =
        results.reduce((sum, qps) => sum + qps, 0) / results.length;
      const variance =
        results.reduce((sum, qps) => sum + (qps - avgQps) ** 2, 0) /
        results.length;
      const stdDev = Math.sqrt(variance);
      const coefficientOfVariation = stdDev / avgQps;

      // 变异系数应该小于 0.5（50%）表示性能稳定
      expect(coefficientOfVariation).toBeLessThan(0.5);

      console.log(
        `平均 QPS: ${avgQps.toFixed(2)}, 变异系数: ${coefficientOfVariation.toFixed(3)}`
      );
    });
  });

  describe("内存使用优化", () => {
    it("应该正确限制调用记录数量以避免内存泄漏", async () => {
      // 重置性能指标
      proxyServer.resetPerformanceMetrics();

      // 模拟大量调用
      mockServiceManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "内存测试" }],
      });

      // 执行超过最大记录数的调用
      const maxRecords = 100;
      const totalCalls = maxRecords + 50;

      for (let i = 0; i < totalCalls; i++) {
        const request = {
          jsonrpc: "2.0",
          id: `memory-test-${i}`,
          method: "tools/call",
          params: {
            name: "fast-tool",
            arguments: { index: i },
          },
        };

        await (proxyServer as any).handleToolCall(request);
      }

      // 验证调用记录数量被正确限制
      const records = proxyServer.getCallRecords();
      expect(records.length).toBeLessThanOrEqual(maxRecords);

      // 验证保留的是最新的记录
      const latestRecord = records[0];
      expect(latestRecord.id).toBe(`memory-test-${totalCalls - 1}`);

      // 验证性能指标仍然准确
      const metrics = proxyServer.getPerformanceMetrics();
      expect(metrics.totalCalls).toBe(totalCalls);
    });

    it("应该在重置后释放内存", async () => {
      // 执行一些调用
      mockServiceManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "重置测试" }],
      });

      for (let i = 0; i < 50; i++) {
        const request = {
          jsonrpc: "2.0",
          id: `reset-test-${i}`,
          method: "tools/call",
          params: {
            name: "fast-tool",
            arguments: { index: i },
          },
        };

        await (proxyServer as any).handleToolCall(request);
      }

      // 验证有数据
      expect(proxyServer.getCallRecords().length).toBe(50);
      expect(proxyServer.getPerformanceMetrics().totalCalls).toBe(50);

      // 重置性能指标
      proxyServer.resetPerformanceMetrics();

      // 验证内存被释放
      expect(proxyServer.getCallRecords().length).toBe(0);
      expect(proxyServer.getPerformanceMetrics().totalCalls).toBe(0);
    });
  });

  describe("重试机制性能优化", () => {
    it("应该在重试时保持合理的性能开销", async () => {
      // 配置重试策略
      proxyServer.updateRetryConfig({
        maxAttempts: 3,
        initialDelay: 10,
        maxDelay: 100,
        backoffMultiplier: 2,
        retryableErrors: [-32001],
      });

      // 模拟成功调用（不触发重试）
      mockServiceManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "成功" }],
      });

      const request = {
        jsonrpc: "2.0",
        id: "retry-perf-test",
        method: "tools/call",
        params: {
          name: "fast-tool",
          arguments: {},
        },
      };

      const startTime = Date.now();
      await (proxyServer as any).handleToolCall(request);
      const duration = Date.now() - startTime;

      // 验证没有重试开销（应该很快完成）
      expect(duration).toBeLessThan(50);

      console.log(`重试性能测试: ${duration}ms`);
    });
  });

  describe("配置更新性能", () => {
    it("应该快速处理配置更新", async () => {
      const iterations = 1000;
      const startTime = Date.now();

      // 快速更新配置多次
      for (let i = 0; i < iterations; i++) {
        proxyServer.updateToolCallConfig({
          timeout: 30000 + i,
          retryAttempts: 3,
        });

        proxyServer.updateRetryConfig({
          maxAttempts: 3,
          initialDelay: 1000 + i,
        });
      }

      const duration = Date.now() - startTime;
      const avgUpdateTime = duration / (iterations * 2); // 两种配置更新

      // 验证配置更新性能（平均每次更新 < 1ms）
      expect(avgUpdateTime).toBeLessThan(1);

      console.log(`配置更新性能: ${avgUpdateTime.toFixed(3)}ms/次`);
    });
  });
});
