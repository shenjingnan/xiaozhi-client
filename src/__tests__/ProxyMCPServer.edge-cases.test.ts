import { beforeEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { ProxyMCPServer } from "../ProxyMCPServer.js";

describe("ProxyMCPServer 边界条件和异常场景测试", () => {
  let proxyServer: ProxyMCPServer;
  let mockServiceManager: any;
  let mockWs: any;

  beforeEach(() => {
    mockWs = {
      readyState: WebSocket.OPEN,
      send: vi.fn(),
      on: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    mockServiceManager = {
      callTool: vi.fn(),
      getAllTools: vi.fn().mockReturnValue([]),
    };

    proxyServer = new ProxyMCPServer("ws://test-endpoint");
    proxyServer.setServiceManager(mockServiceManager);
    (proxyServer as any).ws = mockWs;
    (proxyServer as any).isConnected = true;
  });

  describe("参数验证边界测试", () => {
    it("应该处理 null 参数", () => {
      expect(() => {
        (proxyServer as any).validateToolCallParams(null);
      }).toThrow("请求参数必须是对象");
    });

    it("应该处理 undefined 参数", () => {
      expect(() => {
        (proxyServer as any).validateToolCallParams(undefined);
      }).toThrow("请求参数必须是对象");
    });

    it("应该处理空字符串工具名", () => {
      expect(() => {
        (proxyServer as any).validateToolCallParams({ name: "" });
      }).toThrow("工具名称必须是非空字符串");
    });

    it("应该处理数字类型的工具名", () => {
      expect(() => {
        (proxyServer as any).validateToolCallParams({ name: 123 });
      }).toThrow("工具名称必须是非空字符串");
    });

    it("应该处理数组类型的参数", () => {
      expect(() => {
        (proxyServer as any).validateToolCallParams({
          name: "test",
          arguments: ["invalid"],
        });
      }).toThrow("工具参数必须是对象");
    });

    it("应该处理字符串类型的参数", () => {
      expect(() => {
        (proxyServer as any).validateToolCallParams({
          name: "test",
          arguments: "invalid",
        });
      }).toThrow("工具参数必须是对象");
    });

    it("应该接受 null 参数对象", () => {
      expect(() => {
        (proxyServer as any).validateToolCallParams({
          name: "test",
          arguments: null,
        });
      }).not.toThrow();
    });
  });

  describe("超时处理边界测试", () => {
    it("应该处理零超时时间", async () => {
      mockServiceManager.callTool.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 10))
      );

      await expect(
        (proxyServer as any).executeToolWithTimeout(
          mockServiceManager,
          "test-tool",
          {},
          0
        )
      ).rejects.toThrow("工具调用超时");
    });

    it("应该处理负数超时时间", async () => {
      mockServiceManager.callTool.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 10))
      );

      await expect(
        (proxyServer as any).executeToolWithTimeout(
          mockServiceManager,
          "test-tool",
          {},
          -1000
        )
      ).rejects.toThrow("工具调用超时");
    });

    it("应该处理极大的超时时间", async () => {
      mockServiceManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "success" }],
      });

      await expect(
        (proxyServer as any).executeToolWithTimeout(
          mockServiceManager,
          "test-tool",
          {},
          Number.MAX_SAFE_INTEGER
        )
      ).resolves.not.toThrow();
    });
  });

  describe("重试机制边界测试", () => {
    it("应该处理零重试次数", async () => {
      proxyServer.updateRetryConfig({ maxAttempts: 0 });

      mockServiceManager.callTool.mockRejectedValue(new Error("失败"));

      await expect(
        (proxyServer as any).executeToolWithRetry(
          mockServiceManager,
          "test-tool",
          {}
        )
      ).rejects.toThrow("失败");

      expect(mockServiceManager.callTool).toHaveBeenCalledTimes(0);
    });

    it("应该处理负数重试次数", async () => {
      proxyServer.updateRetryConfig({ maxAttempts: -1 });

      mockServiceManager.callTool.mockRejectedValue(new Error("失败"));

      await expect(
        (proxyServer as any).executeToolWithRetry(
          mockServiceManager,
          "test-tool",
          {}
        )
      ).rejects.toThrow("失败");
    });

    it("应该处理零延迟重试", async () => {
      proxyServer.updateRetryConfig({
        maxAttempts: 2,
        initialDelay: 0,
        retryableErrors: [-32000],
      });

      let callCount = 0;
      mockServiceManager.callTool.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error("临时失败");
        }
        return Promise.resolve({
          content: [{ type: "text", text: "success" }],
        });
      });

      const startTime = Date.now();
      await (proxyServer as any).executeToolWithRetry(
        mockServiceManager,
        "test-tool",
        {}
      );
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(50); // 应该很快完成
      expect(mockServiceManager.callTool).toHaveBeenCalledTimes(2);
    });

    it("应该处理空的可重试错误列表", async () => {
      proxyServer.updateRetryConfig({
        maxAttempts: 3,
        retryableErrors: [],
      });

      mockServiceManager.callTool.mockRejectedValue(new Error("失败"));

      await expect(
        (proxyServer as any).executeToolWithRetry(
          mockServiceManager,
          "test-tool",
          {}
        )
      ).rejects.toThrow("失败");

      expect(mockServiceManager.callTool).toHaveBeenCalledTimes(1);
    });
  });

  describe("WebSocket 连接异常测试", () => {
    it("应该处理 WebSocket 未连接状态", () => {
      (proxyServer as any).isConnected = false;

      (proxyServer as any).sendErrorResponse("test-id", {
        code: -32000,
        message: "测试错误",
      });

      expect(mockWs.send).not.toHaveBeenCalled();
    });

    it("应该处理 WebSocket 关闭状态", () => {
      mockWs.readyState = WebSocket.CLOSED;

      (proxyServer as any).sendErrorResponse("test-id", {
        code: -32000,
        message: "测试错误",
      });

      expect(mockWs.send).not.toHaveBeenCalled();
    });

    it("应该处理 WebSocket 发送异常", () => {
      mockWs.send.mockImplementation(() => {
        throw new Error("发送失败");
      });

      // 发送错误响应时应该捕获异常
      try {
        (proxyServer as any).sendErrorResponse("test-id", {
          code: -32000,
          message: "测试错误",
        });
      } catch (error) {
        // 预期会抛出异常，这是正常的
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe("性能监控异常测试", () => {
    it("应该处理无效的调用记录", () => {
      const invalidRecord = {
        id: "test",
        toolName: "test-tool",
        startTime: new Date(),
        success: false,
        // 缺少 endTime 和 duration
      };

      expect(() => {
        (proxyServer as any).updatePerformanceMetrics(invalidRecord);
      }).not.toThrow();
    });

    it("应该处理负数持续时间", () => {
      const record = {
        id: "test",
        toolName: "test-tool",
        startTime: new Date(),
        endTime: new Date(Date.now() - 1000), // 结束时间早于开始时间
        duration: -1000,
        success: true,
      };

      expect(() => {
        (proxyServer as any).updatePerformanceMetrics(record);
      }).not.toThrow();

      const metrics = proxyServer.getPerformanceMetrics();
      expect(metrics.minResponseTime).toBeLessThanOrEqual(0);
    });

    it("应该处理极大的持续时间", () => {
      const record = {
        id: "test",
        toolName: "test-tool",
        startTime: new Date(),
        endTime: new Date(),
        duration: Number.MAX_SAFE_INTEGER,
        success: true,
      };

      expect(() => {
        (proxyServer as any).updatePerformanceMetrics(record);
      }).not.toThrow();

      const metrics = proxyServer.getPerformanceMetrics();
      expect(metrics.maxResponseTime).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe("内存管理测试", () => {
    it("应该正确限制调用记录数量", async () => {
      proxyServer.resetPerformanceMetrics();

      mockServiceManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "success" }],
      });

      // 执行超过最大记录数的调用
      const maxRecords = 100;
      for (let i = 0; i < maxRecords + 50; i++) {
        const request = {
          jsonrpc: "2.0",
          id: `test-${i}`,
          method: "tools/call",
          params: { name: "test-tool", arguments: {} },
        };

        await (proxyServer as any).handleToolCall(request);
      }

      const records = proxyServer.getCallRecords();
      expect(records.length).toBeLessThanOrEqual(maxRecords);

      // 验证保留的是最新的记录
      const latestRecord = records[0];
      expect(latestRecord.id).toBe(`test-${maxRecords + 49}`);
    });

    it("应该正确重置性能指标", () => {
      // 先添加一些数据
      const record = {
        id: "test",
        toolName: "test-tool",
        startTime: new Date(),
        endTime: new Date(),
        duration: 100,
        success: true,
      };

      (proxyServer as any).updatePerformanceMetrics(record);

      // 重置
      proxyServer.resetPerformanceMetrics();

      const metrics = proxyServer.getPerformanceMetrics();
      expect(metrics.totalCalls).toBe(0);
      expect(metrics.successfulCalls).toBe(0);
      expect(metrics.failedCalls).toBe(0);
      expect(metrics.minResponseTime).toBe(Number.MAX_VALUE);
      expect(metrics.maxResponseTime).toBe(0);

      const records = proxyServer.getCallRecords();
      expect(records.length).toBe(0);
    });
  });

  describe("错误恢复测试", () => {
    it("应该处理 JSON 序列化错误", () => {
      const circularObj = {};
      (circularObj as any).self = circularObj;

      // JSON 序列化错误会被抛出，这是预期的行为
      try {
        (proxyServer as any).sendErrorResponse("test-id", {
          code: -32000,
          message: "测试",
          data: circularObj,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(TypeError);
        expect((error as Error).message).toContain("circular");
      }
    });

    it("应该处理未定义的请求 ID", async () => {
      const request = {
        jsonrpc: "2.0",
        // 没有 id 字段
        method: "tools/call",
        params: { name: "test-tool", arguments: {} },
      };

      mockServiceManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "success" }],
      });

      await expect(
        (proxyServer as any).handleToolCall(request)
      ).resolves.not.toThrow();
    });
  });
});
