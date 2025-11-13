import { beforeEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { ProxyMCPServer } from "../ProxyMCPServer";

describe("ProxyMCPServer 集成测试", () => {
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
          name: "calculator",
          description: "数学计算工具",
          inputSchema: {
            type: "object",
            properties: {
              expression: { type: "string", description: "数学表达式" },
            },
            required: ["expression"],
          },
        },
        {
          name: "weather",
          description: "天气查询工具",
          inputSchema: {
            type: "object",
            properties: {
              city: { type: "string", description: "城市名称" },
            },
            required: ["city"],
          },
        },
      ]),
    };

    proxyServer = new ProxyMCPServer("ws://test-endpoint");
    proxyServer.setServiceManager(mockServiceManager);

    // 设置模拟的 WebSocket 连接
    (proxyServer as any).ws = mockWs;
    (proxyServer as any).connectionStatus = true;
  });

  describe("端到端工具调用流程", () => {
    it("应该完成完整的工具调用流程", async () => {
      // 模拟工具调用成功
      mockServiceManager.callTool.mockResolvedValue({
        content: [
          {
            type: "text",
            text: "2 + 2 = 4",
          },
        ],
      });

      // 构造完整的工具调用请求
      const request = {
        jsonrpc: "2.0",
        id: "calc-test-1",
        method: "tools/call",
        params: {
          name: "calculator",
          arguments: {
            expression: "2 + 2",
          },
        },
      };

      // 执行工具调用
      await (proxyServer as any).handleToolCall(request);

      // 验证调用流程
      expect(mockServiceManager.callTool).toHaveBeenCalledWith("calculator", {
        expression: "2 + 2",
      });

      // 验证响应发送
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"result"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"content"')
      );

      // 验证性能指标更新
      const metrics = proxyServer.getPerformanceMetrics();
      expect(metrics.totalCalls).toBe(1);
      expect(metrics.successfulCalls).toBe(1);
      expect(metrics.failedCalls).toBe(0);
    });

    it("应该处理工具调用失败的完整流程", async () => {
      // 模拟工具调用失败
      mockServiceManager.callTool.mockRejectedValue(
        new Error("计算服务不可用")
      );

      const request = {
        jsonrpc: "2.0",
        id: "calc-test-2",
        method: "tools/call",
        params: {
          name: "calculator",
          arguments: {
            expression: "invalid",
          },
        },
      };

      // 执行工具调用
      await (proxyServer as any).handleToolCall(request);

      // 验证错误响应
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"error"')
      );

      // 验证性能指标更新
      const metrics = proxyServer.getPerformanceMetrics();
      expect(metrics.totalCalls).toBe(1);
      expect(metrics.successfulCalls).toBe(0);
      expect(metrics.failedCalls).toBe(1);
    });

    it("应该处理工具列表查询的完整流程", async () => {
      const request = {
        jsonrpc: "2.0",
        id: "tools-list-1",
        method: "tools/list",
      };

      // 执行工具列表查询
      await (proxyServer as any).handleServerRequest(request);

      // 验证工具同步
      expect(mockServiceManager.getAllTools).toHaveBeenCalled();

      // 验证响应发送
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"tools"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"calculator"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"weather"')
      );
    });
  });

  describe("并发调用场景", () => {
    it("应该正确处理多个并发工具调用", async () => {
      // 模拟不同的工具调用结果
      mockServiceManager.callTool
        .mockResolvedValueOnce({
          content: [{ type: "text", text: "计算结果: 10" }],
        })
        .mockResolvedValueOnce({
          content: [{ type: "text", text: "天气: 晴天" }],
        })
        .mockResolvedValueOnce({
          content: [{ type: "text", text: "计算结果: 20" }],
        });

      // 创建多个并发请求
      const requests = [
        {
          jsonrpc: "2.0",
          id: "concurrent-1",
          method: "tools/call",
          params: {
            name: "calculator",
            arguments: { expression: "5 + 5" },
          },
        },
        {
          jsonrpc: "2.0",
          id: "concurrent-2",
          method: "tools/call",
          params: {
            name: "weather",
            arguments: { city: "北京" },
          },
        },
        {
          jsonrpc: "2.0",
          id: "concurrent-3",
          method: "tools/call",
          params: {
            name: "calculator",
            arguments: { expression: "10 + 10" },
          },
        },
      ];

      // 并发执行所有请求
      await Promise.all(
        requests.map((request) => (proxyServer as any).handleToolCall(request))
      );

      // 验证所有调用都被执行
      expect(mockServiceManager.callTool).toHaveBeenCalledTimes(3);
      expect(mockServiceManager.callTool).toHaveBeenCalledWith("calculator", {
        expression: "5 + 5",
      });
      expect(mockServiceManager.callTool).toHaveBeenCalledWith("weather", {
        city: "北京",
      });
      expect(mockServiceManager.callTool).toHaveBeenCalledWith("calculator", {
        expression: "10 + 10",
      });

      // 验证所有响应都被发送
      expect(mockWs.send).toHaveBeenCalledTimes(3);

      // 验证性能指标
      const metrics = proxyServer.getPerformanceMetrics();
      expect(metrics.totalCalls).toBe(3);
      expect(metrics.successfulCalls).toBe(3);
      expect(metrics.failedCalls).toBe(0);
    });

    it("应该正确处理部分失败的并发调用", async () => {
      // 模拟部分成功、部分失败的场景
      mockServiceManager.callTool
        .mockResolvedValueOnce({
          content: [{ type: "text", text: "成功结果" }],
        })
        .mockRejectedValueOnce(new Error("服务错误"))
        .mockResolvedValueOnce({
          content: [{ type: "text", text: "另一个成功结果" }],
        });

      const requests = [
        {
          jsonrpc: "2.0",
          id: "mixed-1",
          method: "tools/call",
          params: {
            name: "calculator",
            arguments: { expression: "1 + 1" },
          },
        },
        {
          jsonrpc: "2.0",
          id: "mixed-2",
          method: "tools/call",
          params: {
            name: "weather",
            arguments: { city: "invalid" },
          },
        },
        {
          jsonrpc: "2.0",
          id: "mixed-3",
          method: "tools/call",
          params: {
            name: "calculator",
            arguments: { expression: "2 + 2" },
          },
        },
      ];

      // 并发执行所有请求
      await Promise.all(
        requests.map((request) => (proxyServer as any).handleToolCall(request))
      );

      // 验证性能指标反映了混合结果
      const metrics = proxyServer.getPerformanceMetrics();
      expect(metrics.totalCalls).toBe(3);
      expect(metrics.successfulCalls).toBe(2);
      expect(metrics.failedCalls).toBe(1);
      expect(Math.round(metrics.successRate * 100) / 100).toBe(66.67); // 2/3 * 100，四舍五入
    });
  });

  describe("故障恢复机制", () => {
    it("应该在网络中断后恢复正常工作", async () => {
      // 模拟网络中断
      mockWs.readyState = WebSocket.CLOSED;

      const request = {
        jsonrpc: "2.0",
        id: "recovery-test-1",
        method: "tools/call",
        params: {
          name: "calculator",
          arguments: { expression: "1 + 1" },
        },
      };

      // 在网络中断时尝试调用
      mockServiceManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "结果: 2" }],
      });

      await (proxyServer as any).handleToolCall(request);

      // 验证在网络中断时不会发送响应
      expect(mockWs.send).not.toHaveBeenCalled();

      // 模拟网络恢复
      mockWs.readyState = WebSocket.OPEN;
      mockWs.send.mockClear();

      // 再次尝试调用
      await (proxyServer as any).handleToolCall(request);

      // 验证网络恢复后可以正常发送响应
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"result"')
      );
    });

    it("应该在服务重启后重新同步工具", async () => {
      // 初始工具列表
      expect((proxyServer as any).tools.size).toBe(2);

      // 模拟服务重启，工具列表变化
      mockServiceManager.getAllTools.mockReturnValue([
        {
          name: "new-tool",
          description: "新工具",
          inputSchema: { type: "object" },
        },
      ]);

      // 重新同步工具
      await (proxyServer as any).syncToolsFromServiceManager();

      // 验证工具列表已更新
      expect((proxyServer as any).tools.size).toBe(1);
      expect((proxyServer as any).tools.has("new-tool")).toBe(true);
      expect((proxyServer as any).tools.has("calculator")).toBe(false);
    });
  });

  describe("与现有系统组件的集成兼容性", () => {
    it("应该与 MCPServiceManager 正确集成", async () => {
      // 验证初始化时的集成
      expect(proxyServer.getStatus().initialized).toBe(false); // 初始状态为 false

      // 验证工具同步集成
      const status = proxyServer.getStatus();
      expect(status.availableTools).toBe(2);

      // 验证工具调用集成
      mockServiceManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "集成测试成功" }],
      });

      const request = {
        jsonrpc: "2.0",
        id: "integration-test",
        method: "tools/call",
        params: {
          name: "calculator",
          arguments: { expression: "test" },
        },
      };

      await (proxyServer as any).handleToolCall(request);

      // 验证调用参数正确传递
      expect(mockServiceManager.callTool).toHaveBeenCalledWith("calculator", {
        expression: "test",
      });
    });

    it("应该正确处理配置更新", async () => {
      // 获取初始配置
      const initialConfig = proxyServer.getConfiguration();

      // 更新工具调用配置
      proxyServer.updateToolCallConfig({
        timeout: 15000,
        retryAttempts: 5,
      });

      // 更新重试配置
      proxyServer.updateRetryConfig({
        maxAttempts: 5,
        initialDelay: 2000,
      });

      // 验证配置已更新
      const updatedConfig = proxyServer.getConfiguration();
      expect(updatedConfig.toolCall.timeout).toBe(15000);
      expect(updatedConfig.toolCall.retryAttempts).toBe(5);
      expect(updatedConfig.retry.maxAttempts).toBe(5);
      expect(updatedConfig.retry.initialDelay).toBe(2000);

      // 验证其他配置保持不变
      expect(updatedConfig.toolCall.retryDelay).toBe(
        initialConfig.toolCall.retryDelay
      );
    });

    it("应该正确处理状态查询", async () => {
      // 执行一些操作来改变状态
      mockServiceManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "测试" }],
      });

      const request = {
        jsonrpc: "2.0",
        id: "status-test",
        method: "tools/call",
        params: {
          name: "calculator",
          arguments: { expression: "1 + 1" },
        },
      };

      await (proxyServer as any).handleToolCall(request);

      // 验证基本状态
      const status = proxyServer.getStatus();
      expect(status.connected).toBe(true);
      expect(status.initialized).toBe(false); // 初始状态为 false
      expect(status.availableTools).toBe(2);

      // 验证增强状态
      const enhancedStatus = proxyServer.getEnhancedStatus();
      expect(enhancedStatus.performance.totalCalls).toBe(1);
      expect(enhancedStatus.configuration).toBeDefined();
    });
  });
});
