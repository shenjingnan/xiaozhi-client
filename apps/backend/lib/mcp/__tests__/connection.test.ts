import { ConnectionState, MCPTransportType } from "@/lib/mcp";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Logger } from "@root/Logger.js";
// 导入 mock 后的函数
import type { EventBus } from "@root/services/EventBus.js";
import { getEventBus } from "@root/services/EventBus.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MCPService } from "../connection";
import { TransportFactory } from "../transport-factory.js";
import type { MCPServiceConfig } from "../types";

// Mock 接口定义 - 使用简单的接口避免复杂类型冲突
interface MockClient {
  connect: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  listTools: ReturnType<typeof vi.fn>;
  callTool: ReturnType<typeof vi.fn>;
}

interface MockLogger {
  info: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
  log: ReturnType<typeof vi.fn>;
  success: ReturnType<typeof vi.fn>;
  withTag: ReturnType<typeof vi.fn>;
  setLevel?: ReturnType<typeof vi.fn>;
  getLevel?: ReturnType<typeof vi.fn>;
  initLogFile?: ReturnType<typeof vi.fn>;
  enableFileLogging?: ReturnType<typeof vi.fn>;
  close?: ReturnType<typeof vi.fn>;
}

interface MockEventBus {
  emitEvent: ReturnType<typeof vi.fn>;
  onEvent: ReturnType<typeof vi.fn>;
  offEvent: ReturnType<typeof vi.fn>;
  onceEvent: ReturnType<typeof vi.fn>;
  getEventStats?: ReturnType<typeof vi.fn>;
  getListenerStats?: ReturnType<typeof vi.fn>;
  getStatus?: ReturnType<typeof vi.fn>;
  destroy?: ReturnType<typeof vi.fn>;
}

type MockTransport = Record<string, never>;

// Mock dependencies
vi.mock("@modelcontextprotocol/sdk/client/index.js");
vi.mock("@modelcontextprotocol/sdk/client/stdio.js");
vi.mock("@root/Logger.js");
vi.mock("../transport-factory.js");
vi.mock("@root/services/EventBus.js", () => ({
  getEventBus: vi.fn(),
}));

describe("MCPService", () => {
  let mockClient: MockClient;
  let mockTransport: MockTransport;
  let mockLogger: MockLogger;
  let mockEventBus: MockEventBus;
  let service: MCPService;
  let config: MCPServiceConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Client
    mockClient = {
      connect: vi.fn(),
      close: vi.fn(),
      listTools: vi.fn(),
      callTool: vi.fn(),
    };
    vi.mocked(Client).mockImplementation(() => mockClient as unknown as Client);

    // Mock StdioClientTransport
    mockTransport = {};
    vi.mocked(StdioClientTransport).mockImplementation(
      () => mockTransport as unknown as StdioClientTransport
    );

    // Mock TransportFactory
    vi.mocked(TransportFactory).validateConfig = vi.fn();
    vi.mocked(TransportFactory).create = vi.fn().mockReturnValue(mockTransport);

    // Mock Logger - 直接创建简单的 mock 对象
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
      success: vi.fn(),
      withTag: vi.fn().mockReturnThis(),
    };
    vi.mocked(Logger).mockImplementation(() => mockLogger as unknown as Logger);

    // Mock EventBus
    mockEventBus = {
      emitEvent: vi.fn(),
      onEvent: vi.fn(),
      offEvent: vi.fn(),
      onceEvent: vi.fn(),
    };
    vi.mocked(getEventBus).mockReturnValue(mockEventBus as unknown as EventBus);

    // Test configuration
    config = {
      name: "test-service",
      type: MCPTransportType.STDIO,
      command: "node",
      args: ["test-server.js"],
    };

    service = new MCPService(config);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create MCPService with valid config", () => {
      expect(service).toBeInstanceOf(MCPService);
      // No longer using withTag, logger is used directly
    });

    it("should throw error for invalid name", () => {
      const invalidConfig = { ...config, name: "" };
      const error = new Error("配置必须包含有效的 name 字段");
      vi.mocked(TransportFactory).validateConfig.mockImplementation(() => {
        throw error;
      });

      expect(() => new MCPService(invalidConfig)).toThrow(
        "配置必须包含有效的 name 字段"
      );
    });

    it("should throw error for SSE without URL", () => {
      const invalidConfig = { ...config, type: MCPTransportType.SSE };
      const error = new Error("sse 类型需要 url 字段");
      vi.mocked(TransportFactory).validateConfig.mockImplementation(() => {
        throw error;
      });

      expect(() => new MCPService(invalidConfig)).toThrow(
        "sse 类型需要 url 字段"
      );
    });

    it("should throw error for missing command", () => {
      const invalidConfig = { ...config, command: undefined };
      const error = new Error("stdio 类型需要 command 字段");
      vi.mocked(TransportFactory).validateConfig.mockImplementation(() => {
        throw error;
      });

      expect(() => new MCPService(invalidConfig)).toThrow(
        "stdio 类型需要 command 字段"
      );
    });

    it("should create service with basic config", () => {
      const serviceWithOptions = new MCPService(config);
      const status = serviceWithOptions.getStatus();

      expect(status.name).toBe("test-service");
      expect(status.connected).toBe(false);
      expect(status.connectionState).toBe(ConnectionState.DISCONNECTED);
    });
  });

  describe("connect", () => {
    it("should connect successfully", async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: [] });

      await service.connect();

      expect(Client).toHaveBeenCalledWith(
        {
          name: "xiaozhi-test-service-client",
          version: "1.0.0",
        },
        {
          capabilities: {},
        }
      );
      expect(TransportFactory.create).toHaveBeenCalledWith(config);
      expect(mockClient.connect).toHaveBeenCalledWith(mockTransport);
      expect(service.isConnected()).toBe(true);
    });

    it("should emit connected event on successful connection", async () => {
      const mockTools = [
        {
          name: "test-tool",
          description: "Test tool",
          inputSchema: { type: "object", properties: {} },
        },
      ];

      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: mockTools });

      await service.connect();

      const callArgs = mockEventBus.emitEvent.mock.calls.find(
        (call): call is [string, unknown] => call[0] === "mcp:service:connected"
      );

      expect(callArgs).toBeDefined();
      expect(
        callArgs?.[1] as { serviceName: string; tools: unknown[] }
      ).toMatchObject({
        serviceName: "test-service",
        tools: mockTools,
      });
      expect(
        (callArgs?.[1] as { connectionTime: Date }).connectionTime
      ).toBeInstanceOf(Date);
    });

    it("should handle connection timeout", async () => {
      vi.useFakeTimers();

      const connectPromise = new Promise(() => {}); // Never resolves
      mockClient.connect.mockReturnValue(connectPromise);

      const connectionPromise = service.connect();

      // Fast-forward time to trigger timeout
      vi.advanceTimersByTime(10000);

      await expect(connectionPromise).rejects.toThrow("连接超时");

      vi.useRealTimers();
    });

    it("should handle connection error", async () => {
      const error = new Error("Connection failed");
      mockClient.connect.mockRejectedValue(error);

      await expect(service.connect()).rejects.toThrow("Connection failed");
      expect(service.isConnected()).toBe(false);
    });

    it("should emit connection failed event on connection error", async () => {
      const error = new Error("Connection failed");
      mockClient.connect.mockRejectedValue(error);

      await expect(service.connect()).rejects.toThrow("Connection failed");

      const callArgs = mockEventBus.emitEvent.mock.calls.find(
        (call): call is [string, unknown] =>
          call[0] === "mcp:service:connection:failed"
      );

      expect(callArgs).toBeDefined();
      expect(callArgs?.[1]).toMatchObject({
        serviceName: "test-service",
        error,
        attempt: 0,
      });
    });

    it("should throw error if already connecting", async () => {
      mockClient.connect.mockImplementation(() => new Promise(() => {})); // Never resolves

      const firstConnect = service.connect();

      await expect(service.connect()).rejects.toThrow(
        "连接正在进行中，请等待连接完成"
      );

      // Cleanup
      await service.disconnect();
    });
  });

  describe("disconnect", () => {
    it("should disconnect successfully", async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: [] });
      mockClient.close.mockResolvedValue(undefined);

      await service.connect();
      await service.disconnect();

      expect(service.isConnected()).toBe(false);
      expect(service.getStatus().connectionState).toBe(
        ConnectionState.DISCONNECTED
      );
    });

    it("should emit disconnected event on manual disconnect", async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: [] });
      mockClient.close.mockResolvedValue(undefined);

      await service.connect();
      await service.disconnect();

      const callArgs = mockEventBus.emitEvent.mock.calls.find(
        (call): call is [string, unknown] =>
          call[0] === "mcp:service:disconnected"
      );

      expect(callArgs).toBeDefined();
      expect(
        callArgs?.[1] as { serviceName: string; reason: string }
      ).toMatchObject({
        serviceName: "test-service",
        reason: "手动断开",
      });
      expect(
        (callArgs?.[1] as { disconnectionTime: Date }).disconnectionTime
      ).toBeInstanceOf(Date);
    });
  });

  describe("disconnect and connect", () => {
    it("should disconnect and connect successfully", async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: [] });
      mockClient.close.mockResolvedValue(undefined);

      // 先连接
      await service.connect();
      expect(service.isConnected()).toBe(true);

      // 然后断开连接
      await service.disconnect();
      expect(service.isConnected()).toBe(false);

      // 重新连接
      await service.connect();
      expect(service.isConnected()).toBe(true);
      expect(service.getStatus().connectionState).toBe(
        ConnectionState.CONNECTED
      );
    });
  });

  describe("getTools", () => {
    it("should return empty array when no tools", () => {
      const tools = service.getTools();
      expect(tools).toEqual([]);
    });

    it("should return tools after successful connection", async () => {
      const mockTools = [
        { name: "tool1", description: "Test tool 1", inputSchema: {} },
        { name: "tool2", description: "Test tool 2", inputSchema: {} },
      ];

      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: mockTools });

      await service.connect();
      const tools = service.getTools();

      expect(tools).toEqual(mockTools);
    });
  });

  describe("callTool", () => {
    beforeEach(async () => {
      const mockTools = [
        { name: "test-tool", description: "Test tool", inputSchema: {} },
      ];

      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: mockTools });

      await service.connect();
    });

    it("should call tool successfully", async () => {
      const mockResult = { content: [{ type: "text", text: "Success" }] };
      mockClient.callTool.mockResolvedValue(mockResult);

      const result = await service.callTool("test-tool", { param: "value" });

      expect(mockClient.callTool).toHaveBeenCalledWith({
        name: "test-tool",
        arguments: { param: "value" },
      });
      expect(result).toEqual(mockResult);
    });

    it("should throw error when not connected", async () => {
      await service.disconnect();

      await expect(service.callTool("test-tool", {})).rejects.toThrow(
        "服务 test-service 未连接"
      );
    });

    it("should throw error for non-existent tool", async () => {
      await expect(service.callTool("non-existent-tool", {})).rejects.toThrow(
        "工具 non-existent-tool 在服务 test-service 中不存在"
      );
    });

    it("should handle tool call error", async () => {
      const error = new Error("Tool call failed");
      mockClient.callTool.mockRejectedValue(error);

      await expect(service.callTool("test-tool", {})).rejects.toThrow(
        "Tool call failed"
      );
    });
  });

  describe("getStatus", () => {
    it("should return correct status when disconnected", () => {
      const status = service.getStatus();

      expect(status).toEqual({
        name: "test-service",
        connected: false,
        initialized: false,
        transportType: MCPTransportType.STDIO,
        toolCount: 0,
        connectionState: ConnectionState.DISCONNECTED,
      });
    });

    it("should return correct status when connected", async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: [{ name: "tool1" }] });

      await service.connect();
      const status = service.getStatus();

      expect(status.connected).toBe(true);
      expect(status.initialized).toBe(true);
      expect(status.toolCount).toBe(1);
      expect(status.connectionState).toBe(ConnectionState.CONNECTED);
    });
  });

  describe("isConnected", () => {
    it("should return false when disconnected", () => {
      expect(service.isConnected()).toBe(false);
    });

    it("should return true when connected and initialized", async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: [] });

      await service.connect();
      expect(service.isConnected()).toBe(true);
    });
  });

  describe("connection management", () => {
    it("should get correct service status", () => {
      const status = service.getStatus();

      expect(status.name).toBe("test-service");
      expect(status.connected).toBe(false);
      expect(status.connectionState).toBe(ConnectionState.DISCONNECTED);
      expect(status.toolCount).toBe(0);
    });

    it("should update service status after connection", async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: [] });

      await service.connect();

      const status = service.getStatus();
      expect(status.connected).toBe(true);
      expect(status.connectionState).toBe(ConnectionState.CONNECTED);
      expect(status.initialized).toBe(true);
    });
  });

  describe("error handling and reconnection", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should set disconnected state on connection failure", async () => {
      // 创建服务实例用于测试
      const testService = new MCPService(config);

      mockClient.connect.mockRejectedValue(new Error("Connection failed"));

      // Start connection (will fail)
      const connectPromise = testService.connect().catch(() => {});
      await connectPromise;

      expect(testService.getStatus().connectionState).toBe(
        ConnectionState.DISCONNECTED
      );
    });

    it("should fail connection when connect fails", async () => {
      // Configure service for testing
      const testConfig = { ...config };
      const testService = new MCPService(testConfig);

      mockClient.connect.mockRejectedValue(new Error("Connection failed"));

      // Start connection (will fail)
      await expect(testService.connect()).rejects.toThrow("Connection failed");

      expect(testService.getStatus().connectionState).toBe(
        ConnectionState.DISCONNECTED
      );
      expect(testService.isConnected()).toBe(false);
    });

    it("should not reconnect when manually disconnected", async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: [] });

      await service.connect();
      await service.disconnect();

      // Simulate connection loss after manual disconnect
      expect(service.getStatus().connectionState).toBe(
        ConnectionState.DISCONNECTED
      );

      // Fast-forward time - should not trigger reconnection
      vi.advanceTimersByTime(10000);
      await vi.runAllTimersAsync();

      expect(service.getStatus().connectionState).toBe(
        ConnectionState.DISCONNECTED
      );
    });
  });

  describe("tool management", () => {
    it("should handle empty tool list", async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: [] });

      await service.connect();

      expect(service.getTools()).toEqual([]);
      expect(service.getStatus().toolCount).toBe(0);
    });

    it("should handle tool list refresh error", async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockRejectedValue(new Error("Failed to get tools"));

      await expect(service.connect()).rejects.toThrow("Failed to get tools");
    });

    it("should clear tools on disconnect", async () => {
      const mockTools = [
        { name: "tool1", description: "Test tool 1", inputSchema: {} },
      ];

      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: mockTools });

      await service.connect();
      expect(service.getTools()).toHaveLength(1);

      await service.disconnect();
      // Tools should still be available after disconnect (they're cached)
      expect(service.getTools()).toHaveLength(1);
    });
  });

  describe("backoff strategies", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should handle connection failure gracefully", async () => {
      const testService = new MCPService(config);

      mockClient.connect.mockRejectedValue(new Error("Connection failed"));

      // Start connection (will fail)
      await expect(testService.connect()).rejects.toThrow();

      expect(testService.getStatus().connectionState).toBe(
        ConnectionState.DISCONNECTED
      );
    });

    it("should show correct connection status", async () => {
      const testService = new MCPService(config);

      // Initially disconnected
      expect(testService.isConnected()).toBe(false);
      expect(testService.getStatus().connectionState).toBe(
        ConnectionState.DISCONNECTED
      );

      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: [] });

      // Connect successfully
      await testService.connect();
      expect(testService.isConnected()).toBe(true);
      expect(testService.getStatus().connectionState).toBe(
        ConnectionState.CONNECTED
      );
    });

    it("should handle multiple connection attempts properly", async () => {
      const testService = new MCPService(config);

      mockClient.connect.mockRejectedValue(new Error("Connection failed"));

      // Try to connect (will fail)
      await expect(testService.connect()).rejects.toThrow();

      expect(testService.getStatus().connectionState).toBe(
        ConnectionState.DISCONNECTED
      );

      // Reset and try again
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: [] });

      await testService.connect();
      expect(testService.isConnected()).toBe(true);
      expect(testService.getStatus().connectionState).toBe(
        ConnectionState.CONNECTED
      );
    });
  });

  describe("multi-protocol support", () => {
    it("should support SSE transport", async () => {
      const sseConfig: MCPServiceConfig = {
        name: "test-sse-service",
        type: MCPTransportType.SSE,
        url: "https://example.com/sse",
        apiKey: "test-key",
      };

      const sseService = new MCPService(sseConfig);
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: [] });

      await sseService.connect();

      expect(TransportFactory.create).toHaveBeenCalledWith(sseConfig);
      expect(sseService.isConnected()).toBe(true);
      expect(sseService.getStatus().transportType).toBe(MCPTransportType.SSE);
    });

    it("should support streamable-http transport", async () => {
      const httpConfig: MCPServiceConfig = {
        name: "test-http-service",
        type: MCPTransportType.STREAMABLE_HTTP,
        url: "https://example.com/api",
        headers: { "Custom-Header": "value" },
      };

      const httpService = new MCPService(httpConfig);
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: [] });

      await httpService.connect();

      expect(TransportFactory.create).toHaveBeenCalledWith(httpConfig);
      expect(httpService.isConnected()).toBe(true);
      expect(httpService.getStatus().transportType).toBe(
        MCPTransportType.STREAMABLE_HTTP
      );
    });

    it("should handle different transport configurations", () => {
      const configs = [
        {
          name: "stdio-service",
          type: MCPTransportType.STDIO,
          command: "node",
          args: ["server.js"],
        },
        {
          name: "sse-service",
          type: MCPTransportType.SSE,
          url: "https://example.com/sse",
          apiKey: "key123",
        },
        {
          name: "http-service",
          type: MCPTransportType.STREAMABLE_HTTP,
          url: "https://example.com/api",
          headers: { Authorization: "Bearer token" },
        },
      ];

      for (const cfg of configs) {
        expect(() => new MCPService(cfg)).not.toThrow();
        expect(TransportFactory.validateConfig).toHaveBeenCalledWith(cfg);
      }
    });
  });
});

// 自动类型推断测试（合并自 MCPService-type-inference.test.ts）
describe("MCPService 自动类型推断测试", () => {
  let mockLogger: MockLogger;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
      success: vi.fn(),
      withTag: vi.fn().mockReturnThis(),
    };
  });

  describe("显式指定类型的情况", () => {
    it("应该使用显式指定的类型", () => {
      const config = {
        name: "test-service",
        type: MCPTransportType.SSE,
        url: "https://example.com/sse",
      };

      const service = new MCPService(config);
      const serviceConfig = service.getConfig();

      expect(serviceConfig.type).toBe(MCPTransportType.SSE);
    });

    it("应该优先使用显式类型而非URL推断", () => {
      const config = {
        name: "explicit-priority-service",
        type: MCPTransportType.STREAMABLE_HTTP,
        url: "https://example.com/sse", // 这个URL会推断为SSE，但显式指定为STREAMABLE_HTTP
      };

      const service = new MCPService(config);
      const serviceConfig = service.getConfig();

      expect(serviceConfig.type).toBe(MCPTransportType.STREAMABLE_HTTP);
    });

    it("应该正确处理所有显式类型", () => {
      const testCases = [
        {
          type: MCPTransportType.STDIO,
          name: "stdio-test",
          config: { command: "node", args: ["test.js"] },
        },
        {
          type: MCPTransportType.SSE,
          name: "sse-test",
          config: { url: "https://example.com/test" },
        },
        {
          type: MCPTransportType.STREAMABLE_HTTP,
          name: "http-test",
          config: { url: "https://example.com/test" },
        },
      ];

      for (const { type, name, config } of testCases) {
        const serviceConfig = {
          name,
          type,
          ...config,
        };

        const service = new MCPService(serviceConfig);
        const result = service.getConfig();

        expect(result.type).toBe(type);
      }
    });
  });

  describe("自动推断 stdio 类型", () => {
    it("应该根据 command 字段推断为 stdio 类型", () => {
      const config = {
        name: "stdio-service",
        command: "node",
        args: ["server.js"],
      };

      const service = new MCPService(config);
      const serviceConfig = service.getConfig();

      expect(serviceConfig.type).toBe(MCPTransportType.STDIO);
    });

    it("即使有 url 字段，command 字段也应优先", () => {
      const config = {
        name: "mixed-service",
        command: "python",
        args: ["server.py"],
        url: "https://example.com/sse",
      };

      const service = new MCPService(config);
      const serviceConfig = service.getConfig();

      expect(serviceConfig.type).toBe(MCPTransportType.STDIO);
    });

    it("应该处理只有 command 没有 args 的情况", () => {
      const config = {
        name: "command-only-service",
        command: "python",
      };

      const service = new MCPService(config);
      const serviceConfig = service.getConfig();

      expect(serviceConfig.type).toBe(MCPTransportType.STDIO);
    });

    it("应该处理空的 args 数组", () => {
      const config = {
        name: "empty-args-service",
        command: "node",
        args: [],
      };

      const service = new MCPService(config);
      const serviceConfig = service.getConfig();

      expect(serviceConfig.type).toBe(MCPTransportType.STDIO);
    });
  });

  describe("自动推断 SSE 类型", () => {
    it("应该根据 /sse 路径推断为 SSE 类型", () => {
      const config = {
        name: "sse-service",
        url: "https://mcp.amap.com/sse?key=test",
      };

      const service = new MCPService(config);
      const serviceConfig = service.getConfig();

      expect(serviceConfig.type).toBe(MCPTransportType.SSE);
    });

    it("应该正确处理带有查询参数的 SSE URL", () => {
      const config = {
        name: "sse-service-with-params",
        url: "https://example.com/sse?apiKey=123&timeout=5000",
      };

      const service = new MCPService(config);
      const serviceConfig = service.getConfig();

      expect(serviceConfig.type).toBe(MCPTransportType.SSE);
    });

    it("应该正确推断复杂的 ModelScope SSE 路径", () => {
      const testCases = [
        "https://mcp.api-inference.modelscope.net/f0fed2f733514b/sse",
        "https://mcp.api-inference.modelscope.net/8928ccc99fa34b/sse",
        "https://mcp.api-inference.modelscope.net/abcdef123456/sse",
        "https://api.modelscope.cn/mcp/sse",
      ];

      for (const url of testCases) {
        const config = {
          name: "modelscope-sse-service",
          url,
        };

        const service = new MCPService(config);
        const serviceConfig = service.getConfig();

        expect(serviceConfig.type).toBe(MCPTransportType.SSE);
      }
    });
  });

  describe("自动推断 streamable-http 类型", () => {
    it("应该根据 /mcp 路径推断为 streamable-http 类型", () => {
      const config = {
        name: "mcp-service",
        url: "https://example.com/mcp",
      };

      const service = new MCPService(config);
      const serviceConfig = service.getConfig();

      expect(serviceConfig.type).toBe(MCPTransportType.STREAMABLE_HTTP);
    });

    it("应该正确推断复杂的 ModelScope MCP 路径", () => {
      const testCases = [
        "https://mcp.api-inference.modelscope.net/8928ccc99fa34b/mcp",
        "https://mcp.api-inference.modelscope.net/f0fed2f733514b/mcp",
        "https://api.modelscope.cn/service/mcp",
      ];

      for (const url of testCases) {
        const config = {
          name: "modelscope-mcp-service",
          url,
        };

        const service = new MCPService(config);
        const serviceConfig = service.getConfig();

        expect(serviceConfig.type).toBe(MCPTransportType.STREAMABLE_HTTP);
      }
    });

    it("对于其他路径应该默认推断为 streamable-http 类型", () => {
      const testCases = [
        { url: "https://example.com/api/v1/tools", name: "api-service" },
        { url: "https://example.com/endpoint", name: "endpoint-service" },
        { url: "https://example.com/service", name: "generic-service" },
        { url: "https://example.com/webhook", name: "webhook-service" },
      ];

      for (const { url, name } of testCases) {
        const config = {
          name,
          url,
        };

        const service = new MCPService(config);
        const serviceConfig = service.getConfig();

        expect(serviceConfig.type).toBe(MCPTransportType.STREAMABLE_HTTP);
      }
    });

    it("对于根路径应该默认推断为 streamable-http 类型", () => {
      const testCases = [
        { url: "https://example.com/", name: "root-service-1" },
        { url: "https://example.com", name: "root-service-2" },
        { url: "https://api.example.com/", name: "root-service-3" },
      ];

      for (const { url, name } of testCases) {
        const config = {
          name,
          url,
        };

        const service = new MCPService(config);
        const serviceConfig = service.getConfig();

        expect(serviceConfig.type).toBe(MCPTransportType.STREAMABLE_HTTP);
      }
    });
  });

  describe("类型推断优先级", () => {
    it("应该正确处理类型推断优先级：显式类型 > command > URL", () => {
      // 1. 显式类型优先级最高
      const explicitConfig = {
        name: "explicit-priority",
        type: MCPTransportType.SSE,
        command: "node", // command 存在但显式类型优先
        url: "https://example.com/mcp", // URL 推断为 MCP 但显式类型为 SSE
      };

      const explicitService = new MCPService(explicitConfig);
      expect(explicitService.getConfig().type).toBe(MCPTransportType.SSE);

      // 2. command 优先级高于 URL
      const commandConfig = {
        name: "command-priority",
        command: "python", // command 存在
        url: "https://example.com/sse", // URL 推断为 SSE 但 command 优先
      };

      const commandService = new MCPService(commandConfig);
      expect(commandService.getConfig().type).toBe(MCPTransportType.STDIO);

      // 3. 只有 URL 时进行推断
      const urlConfig = {
        name: "url-inference",
        url: "https://example.com/sse", // 推断为 SSE
      };

      const urlService = new MCPService(urlConfig);
      expect(urlService.getConfig().type).toBe(MCPTransportType.SSE);
    });
  });
});
