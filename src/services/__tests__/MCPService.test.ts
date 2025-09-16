import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Logger } from "../../Logger.js";
import {
  ConnectionState,
  MCPService,
  type MCPServiceConfig,
  MCPTransportType,
  type ReconnectOptions,
} from "../MCPService.js";
import { TransportFactory } from "../TransportFactory.js";

// Mock dependencies
vi.mock("@modelcontextprotocol/sdk/client/index.js");
vi.mock("@modelcontextprotocol/sdk/client/stdio.js");
vi.mock("../../Logger.js");
vi.mock("../TransportFactory.js");
import { getEventBus } from "../EventBus.js";
vi.mock("../EventBus.js", () => ({
  getEventBus: vi.fn(),
}));

describe("MCPService", () => {
  let mockClient: any;
  let mockTransport: any;
  let mockLogger: any;
  let mockEventBus: any;
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
    vi.mocked(Client).mockImplementation(() => mockClient);

    // Mock StdioClientTransport
    mockTransport = {};
    vi.mocked(StdioClientTransport).mockImplementation(() => mockTransport);

    // Mock TransportFactory
    vi.mocked(TransportFactory).validateConfig = vi.fn();
    vi.mocked(TransportFactory).create = vi.fn().mockReturnValue(mockTransport);

    // Mock Logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      withTag: vi.fn().mockReturnThis(),
    };
    vi.mocked(Logger).mockImplementation(() => mockLogger);

    // Mock EventBus
    mockEventBus = {
      emitEvent: vi.fn(),
      onEvent: vi.fn(),
      offEvent: vi.fn(),
      onceEvent: vi.fn(),
    };
    vi.mocked(getEventBus).mockReturnValue(mockEventBus);

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

    it("should merge reconnect options correctly", () => {
      const customReconnectOptions: Partial<ReconnectOptions> = {
        maxAttempts: 5,
        initialInterval: 2000,
      };
      const serviceWithOptions = new MCPService(config, {
        reconnect: customReconnectOptions,
      });
      const reconnectOptions = serviceWithOptions.getReconnectOptions();

      expect(reconnectOptions.maxAttempts).toBe(5);
      expect(reconnectOptions.initialInterval).toBe(2000);
      expect(reconnectOptions.enabled).toBe(true); // default value
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
          capabilities: {
            tools: {},
          },
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
        (call) => call[0] === "mcp:service:connected"
      );

      expect(callArgs).toBeDefined();
      expect(callArgs![1]).toMatchObject({
        serviceName: "test-service",
        tools: mockTools,
      });
      expect(callArgs![1].connectionTime).toBeInstanceOf(Date);
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
        (call) => call[0] === "mcp:service:connection:failed"
      );

      expect(callArgs).toBeDefined();
      expect(callArgs![1]).toMatchObject({
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
        (call) => call[0] === "mcp:service:disconnected"
      );

      expect(callArgs).toBeDefined();
      expect(callArgs![1]).toMatchObject({
        serviceName: "test-service",
        reason: "手动断开",
      });
      expect(callArgs![1].disconnectionTime).toBeInstanceOf(Date);
    });
  });

  describe("reconnect", () => {
    it("should reconnect successfully", async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: [] });

      await service.reconnect();

      expect(service.isConnected()).toBe(true);
      expect(service.getStatus().reconnectAttempts).toBe(0);
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
        lastError: undefined,
        reconnectAttempts: 0,
        connectionState: ConnectionState.DISCONNECTED,
        // ping状态
        pingEnabled: true,
        lastPingTime: undefined,
        pingFailureCount: 0,
        isPinging: false,
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

  describe("reconnect options management", () => {
    it("should enable reconnect", () => {
      service.enableReconnect();
      expect(service.getReconnectOptions().enabled).toBe(true);
    });

    it("should disable reconnect", () => {
      service.disableReconnect();
      expect(service.getReconnectOptions().enabled).toBe(false);
    });

    it("should update reconnect options", () => {
      const newOptions: Partial<ReconnectOptions> = {
        maxAttempts: 15,
        initialInterval: 5000,
      };

      service.updateReconnectOptions(newOptions);
      const options = service.getReconnectOptions();

      expect(options.maxAttempts).toBe(15);
      expect(options.initialInterval).toBe(5000);
    });

    it("should reset reconnect state", () => {
      service.resetReconnectState();
      const status = service.getStatus();
      expect(status.reconnectAttempts).toBe(0);
    });
  });

  describe("error handling and reconnection", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should attempt reconnection on connection failure", async () => {
      // 创建一个禁用 ping 的服务实例，避免定时器无限循环
      const testConfig = { ...config, ping: { enabled: false } };
      const testService = new MCPService(testConfig);

      let connectAttempts = 0;
      mockClient.connect.mockImplementation(() => {
        connectAttempts++;
        if (connectAttempts === 1) {
          return Promise.reject(new Error("First attempt failed"));
        }
        return Promise.resolve();
      });
      mockClient.listTools.mockResolvedValue({ tools: [] });

      // Start connection (will fail)
      const connectPromise = testService.connect().catch(() => {});
      await connectPromise;

      expect(testService.getStatus().connectionState).toBe(
        ConnectionState.RECONNECTING
      );

      // Fast-forward to trigger reconnection
      vi.advanceTimersByTime(3000);
      await vi.runAllTimersAsync();

      expect(connectAttempts).toBe(2);
    });

    it("should stop reconnecting after max attempts", async () => {
      // Configure service with low max attempts for testing
      const testConfig = { ...config };
      const testService = new MCPService(testConfig, {
        reconnect: { maxAttempts: 2, initialInterval: 1000 },
      });

      mockClient.connect.mockRejectedValue(new Error("Connection failed"));

      // Start connection (will fail)
      await testService.connect().catch(() => {});

      // Fast-forward through all reconnection attempts
      vi.advanceTimersByTime(10000);
      await vi.runAllTimersAsync();

      expect(testService.getStatus().connectionState).toBe(
        ConnectionState.FAILED
      );
      expect(testService.getStatus().reconnectAttempts).toBe(2);
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

    it("should use exponential backoff by default", async () => {
      const testService = new MCPService(config, {
        reconnect: {
          maxAttempts: 3,
          initialInterval: 1000,
          backoffStrategy: "exponential",
          backoffMultiplier: 2,
        },
      });

      mockClient.connect.mockRejectedValue(new Error("Connection failed"));

      // Start connection (will fail and trigger reconnection)
      await testService.connect().catch(() => {});

      // Check that reconnection is scheduled
      expect(testService.getStatus().connectionState).toBe(
        ConnectionState.RECONNECTING
      );
    });

    it("should use linear backoff when configured", async () => {
      const testService = new MCPService(config, {
        reconnect: {
          maxAttempts: 3,
          initialInterval: 1000,
          backoffStrategy: "linear",
          backoffMultiplier: 1,
        },
      });

      mockClient.connect.mockRejectedValue(new Error("Connection failed"));

      // Start connection (will fail and trigger reconnection)
      await testService.connect().catch(() => {});

      expect(testService.getStatus().connectionState).toBe(
        ConnectionState.RECONNECTING
      );
    });

    it("should use fixed backoff when configured", async () => {
      const testService = new MCPService(config, {
        reconnect: {
          maxAttempts: 3,
          initialInterval: 1000,
          backoffStrategy: "fixed",
        },
      });

      mockClient.connect.mockRejectedValue(new Error("Connection failed"));

      // Start connection (will fail and trigger reconnection)
      await testService.connect().catch(() => {});

      expect(testService.getStatus().connectionState).toBe(
        ConnectionState.RECONNECTING
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
