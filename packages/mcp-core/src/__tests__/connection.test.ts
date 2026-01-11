import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionState } from "../types.js";
import { MCPTransportType } from "../types.js";
import type { MCPServerTransport, MCPServiceConfig } from "../types.js";
import { MCPConnection } from "../connection.js";

// Mock 接口定义
interface MockClient {
  connect: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  listTools: ReturnType<typeof vi.fn>;
  callTool: ReturnType<typeof vi.fn>;
}

// Mock 依赖
vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: vi.fn(),
}));

// Mock transport-factory - 返回一个对象，包含 mock 函数
vi.mock("../transport-factory.js", () => {
  const mockTransportFactory = {
    validateConfig: vi.fn(),
    create: vi.fn(),
    getSupportedTypes: vi.fn().mockReturnValue([
      "stdio",
      "sse",
      "streamable-http",
    ]),
  };

  return {
    TransportFactory: mockTransportFactory,
    __mockTransportFactory: mockTransportFactory,
  };
});

// 获取 mock 函数
let mockTransportFactory: {
  validateConfig: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  getSupportedTypes: ReturnType<typeof vi.fn>;
};

// 使用 beforeAll 来获取 mock 函数
beforeAll(async () => {
  const module = await import("../transport-factory.js");
  mockTransportFactory = (module as unknown as {
    __mockTransportFactory: {
      validateConfig: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      getSupportedTypes: ReturnType<typeof vi.fn>;
    };
  }).__mockTransportFactory;
});

describe("MCPConnection", () => {
  let mockClient: MockClient;
  let mockTransport: MCPServerTransport;
  let connection: MCPConnection;
  let config: MCPServiceConfig;
  let mockCallbacks: {
    onConnected: ReturnType<typeof vi.fn>;
    onDisconnected: ReturnType<typeof vi.fn>;
    onConnectionFailed: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock Client
    mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      listTools: vi.fn().mockResolvedValue({ tools: [] }),
      callTool: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "Success" }],
      }),
    };
    vi.mocked(Client).mockImplementation(() => mockClient as unknown as Client);

    // Mock Transport - 创建一个具有必要方法的 mock transport
    mockTransport = {
      async start() {
        return undefined;
      },
      async close() {
        return undefined;
      },
    } as unknown as MCPServerTransport;

    // Mock TransportFactory
    mockTransportFactory.validateConfig.mockReset();
    mockTransportFactory.create.mockReset();
    mockTransportFactory.create.mockReturnValue(mockTransport);
    mockTransportFactory.getSupportedTypes.mockReset();
    mockTransportFactory.getSupportedTypes.mockReturnValue([
      MCPTransportType.STDIO,
      MCPTransportType.SSE,
      MCPTransportType.STREAMABLE_HTTP,
    ]);

    // Mock callbacks
    mockCallbacks = {
      onConnected: vi.fn(),
      onDisconnected: vi.fn(),
      onConnectionFailed: vi.fn(),
    };

    // Test configuration
    config = {
      name: "test-service",
      type: MCPTransportType.STDIO,
      command: "node",
      args: ["test-server.js"],
    };

    connection = new MCPConnection(config, mockCallbacks);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe("constructor", () => {
    it("应该创建 MCPConnection 实例", () => {
      expect(connection).toBeInstanceOf(MCPConnection);
    });

    it("应该验证配置", () => {
      expect(mockTransportFactory.validateConfig).toHaveBeenCalled();
    });

    it("应该返回正确的配置", () => {
      const resultConfig = connection.getConfig();
      expect(resultConfig.name).toBe("test-service");
      expect(resultConfig.type).toBe(MCPTransportType.STDIO);
    });
  });

  describe("connect", () => {
    it("应该成功连接", async () => {
      await connection.connect();

      expect(mockTransportFactory.create).toHaveBeenCalledWith(config);
      expect(mockClient.connect).toHaveBeenCalledWith(mockTransport);
      expect(connection.isConnected()).toBe(true);
    });

    it("连接成功时应该发射 onConnected 事件", async () => {
      const mockTools = [
        {
          name: "test-tool",
          description: "测试工具",
          inputSchema: { type: "object" },
        },
      ];
      mockClient.listTools.mockResolvedValue({ tools: mockTools });

      await connection.connect();

      expect(mockCallbacks.onConnected).toHaveBeenCalledWith({
        serviceName: "test-service",
        tools: mockTools,
        connectionTime: expect.any(Date),
      });
    });

    it("应该处理连接超时", async () => {
      mockClient.connect.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const connectionPromise = connection.connect();

      // 快进时间以触发超时
      vi.advanceTimersByTime(10000);

      await expect(connectionPromise).rejects.toThrow("连接超时");
    });

    it("应该处理连接错误", async () => {
      const error = new Error("Connection failed");
      mockClient.connect.mockRejectedValue(error);

      await expect(connection.connect()).rejects.toThrow("Connection failed");
      expect(connection.isConnected()).toBe(false);
    });

    it("连接失败时应该发射 onConnectionFailed 事件", async () => {
      const error = new Error("Connection failed");
      mockClient.connect.mockRejectedValue(error);

      await connection.connect().catch(() => {});

      expect(mockCallbacks.onConnectionFailed).toHaveBeenCalledWith({
        serviceName: "test-service",
        error,
        attempt: 0,
      });
    });

    it("如果正在连接中应该抛出错误", async () => {
      mockClient.connect.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const firstConnect = connection.connect();

      await expect(connection.connect()).rejects.toThrow(
        "连接正在进行中，请等待连接完成"
      );

      // 清理
      firstConnect.catch(() => {});
    });
  });

  describe("disconnect", () => {
    it("应该成功断开连接", async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: [] });

      await connection.connect();
      await connection.disconnect();

      expect(connection.isConnected()).toBe(false);
      expect(connection.getStatus().connectionState).toBe(
        ConnectionState.DISCONNECTED
      );
    });

    it("断开连接时应该发射 onDisconnected 事件", async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: [] });
      mockClient.close.mockResolvedValue(undefined);

      await connection.connect();
      await connection.disconnect();

      expect(mockCallbacks.onDisconnected).toHaveBeenCalledWith({
        serviceName: "test-service",
        reason: "手动断开",
        disconnectionTime: expect.any(Date),
      });
    });
  });

  describe("disconnect and reconnect", () => {
    it("应该能够断开并重新连接", async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: [] });
      mockClient.close.mockResolvedValue(undefined);

      // 先连接
      await connection.connect();
      expect(connection.isConnected()).toBe(true);

      // 然后断开连接
      await connection.disconnect();
      expect(connection.isConnected()).toBe(false);

      // 重新连接
      await connection.connect();
      expect(connection.isConnected()).toBe(true);
      expect(connection.getStatus().connectionState).toBe(
        ConnectionState.CONNECTED
      );
    });
  });

  describe("getTools", () => {
    it("未连接时应该返回空数组", () => {
      const tools = connection.getTools();
      expect(tools).toEqual([]);
    });

    it("连接成功后应该返回工具列表", async () => {
      const mockTools = [
        { name: "tool1", description: "测试工具 1", inputSchema: {} },
        { name: "tool2", description: "测试工具 2", inputSchema: {} },
      ] as Tool[];

      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: mockTools });

      await connection.connect();
      const tools = connection.getTools();

      expect(tools).toEqual(mockTools);
    });
  });

  describe("callTool", () => {
    beforeEach(async () => {
      const mockTools = [
        { name: "test-tool", description: "测试工具", inputSchema: {} },
      ] as Tool[];

      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: mockTools });

      await connection.connect();
    });

    it("应该成功调用工具", async () => {
      const mockResult = { content: [{ type: "text", text: "成功" }] };
      mockClient.callTool.mockResolvedValue(mockResult);

      const result = await connection.callTool("test-tool", {
        param: "value",
      });

      expect(mockClient.callTool).toHaveBeenCalledWith({
        name: "test-tool",
        arguments: { param: "value" },
      });
      expect(result).toEqual(mockResult);
    });

    it("未连接时应该抛出错误", async () => {
      await connection.disconnect();

      await expect(
        connection.callTool("test-tool", {})
      ).rejects.toThrow("服务 test-service 未连接");
    });

    it("工具不存在时应该抛出错误", async () => {
      await expect(
        connection.callTool("non-existent-tool", {})
      ).rejects.toThrow("工具 non-existent-tool 在服务 test-service 中不存在");
    });

    it("应该处理工具调用错误", async () => {
      const error = new Error("Tool call failed");
      mockClient.callTool.mockRejectedValue(error);

      await expect(connection.callTool("test-tool", {})).rejects.toThrow(
        "Tool call failed"
      );
    });
  });

  describe("getStatus", () => {
    it("未连接时应该返回正确的状态", () => {
      const status = connection.getStatus();

      expect(status).toEqual({
        name: "test-service",
        connected: false,
        initialized: false,
        transportType: MCPTransportType.STDIO,
        toolCount: 0,
        connectionState: ConnectionState.DISCONNECTED,
      });
    });

    it("连接后应该返回正确的状态", async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({
        tools: [{ name: "tool1" } as Tool],
      });

      await connection.connect();
      const status = connection.getStatus();

      expect(status.connected).toBe(true);
      expect(status.initialized).toBe(true);
      expect(status.toolCount).toBe(1);
      expect(status.connectionState).toBe(ConnectionState.CONNECTED);
    });
  });

  describe("isConnected", () => {
    it("未连接时应该返回 false", () => {
      expect(connection.isConnected()).toBe(false);
    });

    it("连接成功后应该返回 true", async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: [] });

      await connection.connect();
      expect(connection.isConnected()).toBe(true);
    });
  });

  describe("connection management", () => {
    it("应该返回正确的服务状态", () => {
      const status = connection.getStatus();

      expect(status.name).toBe("test-service");
      expect(status.connected).toBe(false);
      expect(status.connectionState).toBe(ConnectionState.DISCONNECTED);
      expect(status.toolCount).toBe(0);
    });

    it("连接后应该更新服务状态", async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: [] });

      await connection.connect();

      const status = connection.getStatus();
      expect(status.connected).toBe(true);
      expect(status.connectionState).toBe(ConnectionState.CONNECTED);
      expect(status.initialized).toBe(true);
    });
  });

  describe("error handling", () => {
    it("连接失败时应该设置 DISCONNECTED 状态", async () => {
      const testConnection = new MCPConnection(config, mockCallbacks);
      mockClient.connect.mockRejectedValue(new Error("Connection failed"));

      await testConnection.connect().catch(() => {});

      expect(testConnection.getStatus().connectionState).toBe(
        ConnectionState.DISCONNECTED
      );
    });

    it("应该正确处理连接失败", async () => {
      const testConnection = new MCPConnection(config, mockCallbacks);
      mockClient.connect.mockRejectedValue(new Error("Connection failed"));

      await expect(testConnection.connect()).rejects.toThrow(
        "Connection failed"
      );

      expect(testConnection.getStatus().connectionState).toBe(
        ConnectionState.DISCONNECTED
      );
      expect(testConnection.isConnected()).toBe(false);
    });
  });

  describe("tool management", () => {
    it("应该处理空工具列表", async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: [] });

      await connection.connect();

      expect(connection.getTools()).toEqual([]);
      expect(connection.getStatus().toolCount).toBe(0);
    });

    it("应该处理工具列表刷新错误", async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockRejectedValue(new Error("Failed to get tools"));

      await expect(connection.connect()).rejects.toThrow(
        "Failed to get tools"
      );
    });

    it("断开连接后工具列表应该被保留", async () => {
      const mockTools = [
        { name: "tool1", description: "测试工具 1", inputSchema: {} },
      ] as Tool[];

      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: mockTools });
      mockClient.close.mockResolvedValue(undefined);

      await connection.connect();
      expect(connection.getTools()).toHaveLength(1);

      await connection.disconnect();
      // 工具列表应该仍然可用（缓存在内存中）
      expect(connection.getTools()).toHaveLength(1);
    });
  });

  describe("多协议支持", () => {
    it("应该支持 SSE transport 配置", () => {
      const sseConfig: MCPServiceConfig = {
        name: "test-sse-service",
        type: MCPTransportType.SSE,
        url: "https://test.example.com/sse",
        apiKey: "test-key",
      };

      const sseConnection = new MCPConnection(sseConfig, mockCallbacks);
      const status = sseConnection.getStatus();

      expect(status.name).toBe("test-sse-service");
      expect(status.transportType).toBe(MCPTransportType.SSE);
    });

    it("应该支持 streamable-http transport 配置", () => {
      const httpConfig: MCPServiceConfig = {
        name: "test-http-service",
        type: MCPTransportType.STREAMABLE_HTTP,
        url: "https://test.example.com/mcp",
        headers: { "Custom-Header": "value" },
      };

      const httpConnection = new MCPConnection(httpConfig, mockCallbacks);
      const status = httpConnection.getStatus();

      expect(status.name).toBe("test-http-service");
      expect(status.transportType).toBe(MCPTransportType.STREAMABLE_HTTP);
    });

    it("应该处理不同的 transport 配置", () => {
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
          url: "https://test.example.com/sse",
          apiKey: "key123",
        },
        {
          name: "http-service",
          type: MCPTransportType.STREAMABLE_HTTP,
          url: "https://test.example.com/mcp",
          headers: { Authorization: "Bearer token" },
        },
      ];

      for (const cfg of configs) {
        expect(() => new MCPConnection(cfg, mockCallbacks)).not.toThrow();
      }
    });
  });

  describe("配置验证", () => {
    it("无效名称时应该抛出错误", () => {
      const error = new Error("配置必须包含有效的 name 字段");
      mockTransportFactory.validateConfig.mockImplementation(() => {
        throw error;
      });

      const invalidConfig = { ...config, name: "" };
      expect(() => new MCPConnection(invalidConfig, mockCallbacks)).toThrow(
        "配置必须包含有效的 name 字段"
      );
    });

    it("SSE 缺少 URL 时应该抛出错误", () => {
      const error = new Error("sse 类型需要 url 字段");
      mockTransportFactory.validateConfig.mockImplementation(() => {
        throw error;
      });

      const invalidConfig = {
        name: "test",
        type: MCPTransportType.SSE,
      };
      expect(() => new MCPConnection(invalidConfig, mockCallbacks)).toThrow(
        "sse 类型需要 url 字段"
      );
    });

    it("缺少 command 时应该抛出错误", () => {
      const error = new Error("stdio 类型需要 command 字段");
      mockTransportFactory.validateConfig.mockImplementation(() => {
        throw error;
      });

      const invalidConfig = {
        name: "test",
        type: MCPTransportType.STDIO,
        command: undefined,
      };
      expect(() => new MCPConnection(invalidConfig, mockCallbacks)).toThrow(
        "stdio 类型需要 command 字段"
      );
    });
  });
});
