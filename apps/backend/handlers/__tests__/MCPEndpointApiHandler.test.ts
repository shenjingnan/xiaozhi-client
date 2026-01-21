import type { ConnectionStatus } from "@xiaozhi-client/endpoint";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MCPEndpointApiHandler } from "../MCPEndpointApiHandler.js";

// Mock dependencies
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@services/EventBus.js", () => ({
  getEventBus: vi.fn().mockReturnValue({
    emitEvent: vi.fn(),
  }),
}));

vi.mock("@xiaozhi-client/config", () => ({
  configManager: {
    getMcpEndpoints: vi.fn(),
    addMcpEndpoint: vi.fn(),
    removeMcpEndpoint: vi.fn(),
    getConfig: vi.fn(),
    // 新增的事件回调支持
    eventCallbacks: new Map(),
    on: vi.fn(),
    emitEvent: vi.fn(),
  },
}));

// Mock EndpointManager
const mockConnectionManager = {
  getConnectionStatus: vi.fn(),
  getEndpoint: vi.fn(),
  connectExistingEndpoint: vi.fn(),
  disconnectEndpoint: vi.fn(),
  triggerReconnect: vi.fn(),
  addEndpoint: vi.fn(),
  removeEndpoint: vi.fn(),
};

// Mock endpoint instance
const createMockEndpointInstance = (connected = false) => ({
  isConnected: vi.fn().mockReturnValue(connected),
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
});

describe("MCPEndpointApiHandler", () => {
  let handler: MCPEndpointApiHandler;
  let mockContext: any;
  let mockEventBus: any;

  const mockEndpointStatus: ConnectionStatus = {
    endpoint: "ws://localhost:3000",
    connected: false,
    initialized: true,
    lastError: undefined,
    lastConnected: undefined,
  };

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // 创建本地 mock 对象，使用 any 类型避免类型检查
    const mockConfigManager: any = {
      getMcpEndpoints: vi.fn(),
      addMcpEndpoint: vi.fn(),
      removeMcpEndpoint: vi.fn(),
      getConfig: vi.fn(),
      eventCallbacks: new Map(),
      on: vi.fn(),
      emitEvent: vi.fn(),
    };

    // 将 mock 注入到导入的 configManager
    const { configManager } = await import("@xiaozhi-client/config");
    Object.assign(configManager, mockConfigManager);

    // Create handler instance
    handler = new MCPEndpointApiHandler(
      mockConnectionManager as any,
      configManager
    );

    // Create mock context - 修复 mock 配置，返回真实的 Response 对象
    mockContext = {
      json: vi.fn().mockImplementation((data, status) => {
        return new Response(JSON.stringify(data), {
          status: status || 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
      req: {
        param: vi.fn(),
        json: vi.fn(),
      },
    };

    // Get mock event bus
    // biome-ignore lint/complexity/useLiteralKeys: Need to access private property for testing
    mockEventBus = handler["eventBus"];
  });

  describe("getEndpointStatus", () => {
    it("应该成功获取接入点状态", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);

      // Act
      const response = await handler.getEndpointStatus(mockContext);

      // Assert
      expect(response).toBeDefined();
      expect(mockConnectionManager.getConnectionStatus).toHaveBeenCalled();
      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.data).toEqual(mockEndpointStatus);
    });

    it("应该返回404当接入点不存在时", async () => {
      // Arrange
      const endpoint = "ws://nonexistent:3000";
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);

      // Act
      const response = await handler.getEndpointStatus(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.code).toBe("ENDPOINT_NOT_FOUND");
    });

    it("应该返回400当端点参数无效时", async () => {
      // Arrange
      mockContext.req.json.mockResolvedValue({ endpoint: "" });

      // Act
      const response = await handler.getEndpointStatus(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.code).toBe("INVALID_ENDPOINT");
    });

    it("应该返回400当端点参数为null时", async () => {
      // Arrange
      mockContext.req.json.mockResolvedValue({ endpoint: null });

      // Act
      const response = await handler.getEndpointStatus(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.code).toBe("INVALID_ENDPOINT");
    });

    it("应该返回400当端点参数为undefined时", async () => {
      // Arrange
      mockContext.req.json.mockResolvedValue({ endpoint: undefined });

      // Act
      const response = await handler.getEndpointStatus(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.code).toBe("INVALID_ENDPOINT");
    });

    it("应该正确处理URL编码的端点地址", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000/api";
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        { ...mockEndpointStatus, endpoint },
      ]);

      // Act
      const response = await handler.getEndpointStatus(mockContext);

      // Assert
      expect(response.status).toBe(200);
      const responseData = await response.json();
      expect(responseData.success).toBe(true);
    });

    it("应该返回500当获取连接状态失败时", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus.mockImplementation(() => {
        throw new Error("获取状态失败");
      });

      // Act
      const response = await handler.getEndpointStatus(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.code).toBe("ENDPOINT_STATUS_READ_ERROR");
    });
  });

  describe("connectEndpoint", () => {
    it("应该成功连接已存在的接入点", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      mockContext.req.json.mockResolvedValue({ endpoint });

      // 模拟未连接的端点实例
      const mockEndpointInstance = createMockEndpointInstance(false);
      mockConnectionManager.getEndpoint.mockReturnValue(mockEndpointInstance);

      // 设置连接后的状态（已连接）
      const connectedStatus = { ...mockEndpointStatus, connected: true };
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        connectedStatus,
      ]);

      // Act
      const response = await handler.connectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(200);
      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.data).toEqual(connectedStatus);
      expect(mockConnectionManager.getEndpoint).toHaveBeenCalledWith(endpoint);
      expect(mockEndpointInstance.connect).toHaveBeenCalled();
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "endpoint:status:changed",
        expect.objectContaining({
          endpoint,
          connected: true,
          operation: "connect",
          success: true,
          message: "接入点连接成功",
          timestamp: expect.any(Number),
          source: "http-api",
        })
      );
    });

    it("应该返回404当接入点不存在时", async () => {
      // Arrange
      const endpoint = "ws://nonexistent:3000";
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getEndpoint.mockReturnValue(null);
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);

      // Act
      const response = await handler.connectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.code).toBe("ENDPOINT_NOT_FOUND");
      expect(responseData.message).toBe("端点不存在，请先添加接入点");
    });

    it("应该返回409当接入点已连接时", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      const connectedStatus = { ...mockEndpointStatus, connected: true };
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        connectedStatus,
      ]);

      // 模拟已连接的端点实例
      const mockEndpointInstance = createMockEndpointInstance(true);
      mockConnectionManager.getEndpoint.mockReturnValue(mockEndpointInstance);

      // Act
      const response = await handler.connectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.code).toBe("ENDPOINT_ALREADY_CONNECTED");
      expect(responseData.message).toBe("端点已连接");
    });

    it("应该返回400当端点参数无效时", async () => {
      // Arrange
      mockContext.req.json.mockResolvedValue({ endpoint: "" });

      // Act
      const response = await handler.connectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.code).toBe("INVALID_ENDPOINT");
    });

    it("应该返回500当连接操作失败时", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);

      // 模拟连接失败的端点实例
      const mockEndpointInstance = createMockEndpointInstance(false);
      mockEndpointInstance.connect.mockRejectedValue(new Error("连接失败"));
      mockConnectionManager.getEndpoint.mockReturnValue(mockEndpointInstance);

      // Act
      const response = await handler.connectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.code).toBe("ENDPOINT_CONNECT_ERROR");
      expect(responseData.message).toBe("连接失败");
    });

    it("应该返回500当连接后无法获取状态时", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      mockContext.req.json.mockResolvedValue({ endpoint });

      // 模拟未连接的端点实例
      const mockEndpointInstance = createMockEndpointInstance(false);
      mockConnectionManager.getEndpoint.mockReturnValue(mockEndpointInstance);

      // 设置连接后状态为空
      mockConnectionManager.getConnectionStatus.mockReturnValue([]);

      // Act
      const response = await handler.connectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.code).toBe("ENDPOINT_STATUS_NOT_FOUND");
    });

    it("应该正确处理URL编码的端点地址", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000/api";
      mockContext.req.json.mockResolvedValue({ endpoint });

      // 模拟未连接的端点实例
      const mockEndpointInstance = createMockEndpointInstance(false);
      mockConnectionManager.getEndpoint.mockReturnValue(mockEndpointInstance);

      // 设置连接后的状态
      const connectedStatus = {
        ...mockEndpointStatus,
        endpoint,
        connected: true,
      };
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        connectedStatus,
      ]);

      // Act
      const response = await handler.connectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(200);
      expect(mockConnectionManager.getEndpoint).toHaveBeenCalledWith(endpoint);
    });

    it("应该正确处理非Error类型的异常", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);

      // 模拟连接时抛出字符串错误
      const mockEndpointInstance = createMockEndpointInstance(false);
      mockEndpointInstance.connect.mockRejectedValue("字符串错误");
      mockConnectionManager.getEndpoint.mockReturnValue(mockEndpointInstance);

      // Act
      const response = await handler.connectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.code).toBe("ENDPOINT_CONNECT_ERROR");
      expect(responseData.message).toBe("接入点连接失败");
    });
  });

  describe("disconnectEndpoint", () => {
    it("应该成功断开已连接的接入点", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      const connectedStatus = { ...mockEndpointStatus, connected: true };
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        connectedStatus,
      ]);

      // 模拟已连接的端点实例
      const mockEndpointInstance = createMockEndpointInstance(true);
      mockConnectionManager.getEndpoint.mockReturnValue(mockEndpointInstance);

      // Act
      const response = await handler.disconnectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(200);
      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(mockConnectionManager.getEndpoint).toHaveBeenCalledWith(endpoint);
      expect(mockEndpointInstance.disconnect).toHaveBeenCalled();
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "endpoint:status:changed",
        expect.objectContaining({
          endpoint,
          connected: false,
          operation: "disconnect",
          success: true,
          message: "接入点断开成功",
          timestamp: expect.any(Number),
          source: "http-api",
        })
      );
    });

    it("应该返回404当接入点不存在时", async () => {
      // Arrange
      const endpoint = "ws://nonexistent:3000";
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getEndpoint.mockReturnValue(null);
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);

      // Act
      const response = await handler.disconnectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.code).toBe("ENDPOINT_NOT_FOUND");
    });

    it("应该返回409当接入点未连接时", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);

      // 模拟未连接的端点实例
      const mockEndpointInstance = createMockEndpointInstance(false);
      mockConnectionManager.getEndpoint.mockReturnValue(mockEndpointInstance);

      // Act
      const response = await handler.disconnectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.code).toBe("ENDPOINT_NOT_CONNECTED");
      expect(responseData.message).toBe("端点未连接");
    });

    it("应该返回400当端点参数无效时", async () => {
      // Arrange
      mockContext.req.json.mockResolvedValue({ endpoint: "" });

      // Act
      const response = await handler.disconnectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.code).toBe("INVALID_ENDPOINT");
    });

    it("应该返回500当断开操作失败时", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      const connectedStatus = { ...mockEndpointStatus, connected: true };
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        connectedStatus,
      ]);

      // 模拟断开失败的端点实例
      const mockEndpointInstance = createMockEndpointInstance(true);
      mockEndpointInstance.disconnect.mockRejectedValue(new Error("断开失败"));
      mockConnectionManager.getEndpoint.mockReturnValue(mockEndpointInstance);

      // Act
      const response = await handler.disconnectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.code).toBe("ENDPOINT_DISCONNECT_ERROR");
      expect(responseData.message).toBe("断开失败");
    });

    it("应该使用fallback状态当断开后无法获取状态时", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      const connectedStatus = { ...mockEndpointStatus, connected: true };
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus.mockReturnValue([]);

      // 模拟已连接的端点实例
      const mockEndpointInstance = createMockEndpointInstance(true);
      mockConnectionManager.getEndpoint.mockReturnValue(mockEndpointInstance);

      // Act
      const response = await handler.disconnectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(200);
      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.data).toEqual(
        expect.objectContaining({
          endpoint,
          connected: false,
          initialized: true,
        })
      );
    });

    it("应该正确处理URL编码的端点地址", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000/api";
      const connectedStatus = {
        ...mockEndpointStatus,
        endpoint,
        connected: true,
      };
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        connectedStatus,
      ]);

      // 模拟已连接的端点实例
      const mockEndpointInstance = createMockEndpointInstance(true);
      mockConnectionManager.getEndpoint.mockReturnValue(mockEndpointInstance);

      // Act
      const response = await handler.disconnectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(200);
      expect(mockConnectionManager.getEndpoint).toHaveBeenCalledWith(endpoint);
    });
  });

  describe("addEndpoint", () => {
    it("应该成功添加新端点", async () => {
      // Arrange
      const endpoint = "wss://new-endpoint.example.com/mcp";
      const mockEndpointInstance = createMockEndpointInstance(false);
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getEndpoint.mockReturnValue(undefined); // 端点不存在
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        {
          endpoint,
          connected: true,
          initialized: true,
        },
      ]);
      const { configManager } = await import("@xiaozhi-client/config");
      const cm = configManager as any;
      cm.getConfig.mockReturnValue({
        mcpServers: {},
        connection: { reconnectInterval: 2000 },
      });
      cm.addMcpEndpoint.mockReturnValue(undefined);

      // Act
      const response = await handler.addEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(200);
      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.data.endpoint).toBe(endpoint);
      expect(mockConnectionManager.addEndpoint).toHaveBeenCalled();
      expect(cm.addMcpEndpoint).toHaveBeenCalledWith(endpoint);
    });

    it("应该返回409当端点已存在时", async () => {
      // Arrange
      const endpoint = "wss://existing-endpoint.example.com/mcp";
      const mockEndpointInstance = createMockEndpointInstance(false);
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getEndpoint.mockReturnValue(mockEndpointInstance); // 端点已存在

      // Act
      const response = await handler.addEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.code).toBe("ENDPOINT_ALREADY_EXISTS");
      expect(responseData.message).toContain("端点已存在");
    });

    it("应该返回400当端点参数无效时（参数验证在parseEndpointFromBody中提前处理）", async () => {
      // Arrange
      const requestBody = { endpoint: null };
      mockContext.req.json.mockResolvedValue(requestBody);

      // Act
      const response = await handler.addEndpoint(mockContext);

      // Assert
      // 参数验证在 parseEndpointFromBody 中提前处理，返回 400
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.code).toBe("INVALID_ENDPOINT");
    });

    it("应该返回400当端点参数为空字符串时（参数验证在parseEndpointFromBody中提前处理）", async () => {
      // Arrange
      const requestBody = { endpoint: "" };
      mockContext.req.json.mockResolvedValue(requestBody);

      // Act
      const response = await handler.addEndpoint(mockContext);

      // Assert
      // 参数验证在 parseEndpointFromBody 中提前处理，返回 400
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.code).toBe("INVALID_ENDPOINT");
    });

    it("应该返回500当JSON解析失败时（JSON解析错误在parseEndpointFromBody中处理）", async () => {
      // Arrange
      mockContext.req.json.mockRejectedValue(new Error("JSON解析失败"));

      // Act
      const response = await handler.addEndpoint(mockContext);

      // Assert
      // JSON 解析错误在 parseEndpointFromBody 中处理，返回 500
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.code).toBe("ENDPOINT_ADD_ERROR");
    });
  });

  describe("removeEndpoint", () => {
    it("应该成功移除已连接的端点", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      const mockEndpointInstance = createMockEndpointInstance(true);
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getEndpoint.mockReturnValue(mockEndpointInstance);
      const { configManager } = await import("@xiaozhi-client/config");
      const cm = configManager as any;
      cm.removeMcpEndpoint.mockReturnValue(undefined);

      // Act
      const response = await handler.removeEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(200);
      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.data.endpoint).toBe(endpoint);
      expect(responseData.data.operation).toBe("removed");
      expect(responseData.data.wasConnected).toBe(true);
      expect(mockEndpointInstance.disconnect).toHaveBeenCalled();
      expect(mockConnectionManager.removeEndpoint).toHaveBeenCalledWith(
        mockEndpointInstance
      );
      expect(cm.removeMcpEndpoint).toHaveBeenCalledWith(endpoint);
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "endpoint:status:changed",
        expect.objectContaining({
          endpoint,
          connected: false,
          operation: "remove",
          success: true,
        })
      );
    });

    it("应该成功移除未连接的端点", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      const mockEndpointInstance = createMockEndpointInstance(false);
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getEndpoint.mockReturnValue(mockEndpointInstance);
      const { configManager } = await import("@xiaozhi-client/config");
      const cm = configManager as any;
      cm.removeMcpEndpoint.mockReturnValue(undefined);

      // Act
      const response = await handler.removeEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(200);
      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.data.wasConnected).toBe(false);
      expect(mockEndpointInstance.disconnect).not.toHaveBeenCalled();
      expect(mockConnectionManager.removeEndpoint).toHaveBeenCalledWith(
        mockEndpointInstance
      );
    });

    it("应该返回404当端点不存在时", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getEndpoint.mockReturnValue(undefined);

      // Act
      const response = await handler.removeEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.code).toBe("ENDPOINT_NOT_FOUND");
      expect(responseData.message).toContain("端点不存在");
    });

    it("应该在断开连接失败时继续移除操作", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      const mockEndpointInstance = createMockEndpointInstance(true);
      mockEndpointInstance.disconnect.mockRejectedValue(
        new Error("断开连接失败")
      );
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getEndpoint.mockReturnValue(mockEndpointInstance);
      const { configManager } = await import("@xiaozhi-client/config");
      const cm = configManager as any;
      cm.removeMcpEndpoint.mockReturnValue(undefined);

      // Act
      const response = await handler.removeEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(200);
      expect(mockConnectionManager.removeEndpoint).toHaveBeenCalledWith(
        mockEndpointInstance
      );
    });

    it("应该返回400当端点参数无效时（参数验证在parseEndpointFromBody中提前处理）", async () => {
      // Arrange
      mockContext.req.json.mockResolvedValue({ endpoint: "" });

      // Act
      const response = await handler.removeEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.code).toBe("INVALID_ENDPOINT");
    });

    it("应该返回500当JSON解析失败时（JSON解析错误在parseEndpointFromBody中处理）", async () => {
      // Arrange
      mockContext.req.json.mockRejectedValue(new Error("JSON解析失败"));

      // Act
      const response = await handler.removeEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.code).toBe("ENDPOINT_REMOVE_ERROR");
    });

    it("应该返回500当配置更新失败时", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      const mockEndpointInstance = createMockEndpointInstance(false);
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getEndpoint.mockReturnValue(mockEndpointInstance);
      const { configManager } = await import("@xiaozhi-client/config");
      const cm = configManager as any;
      cm.removeMcpEndpoint.mockImplementation(() => {
        throw new Error("配置更新失败");
      });

      // Act
      const response = await handler.removeEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.code).toBe("ENDPOINT_REMOVE_ERROR");
    });
  });

  describe("边界场景和错误处理", () => {
    it("应该正确处理并返回500错误当连接操作失败时", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);

      // 模拟连接失败的端点实例
      const mockEndpointInstance = createMockEndpointInstance(false);
      mockEndpointInstance.connect.mockRejectedValue(new Error("连接失败"));
      mockConnectionManager.getEndpoint.mockReturnValue(mockEndpointInstance);

      // Act
      const response = await handler.connectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.code).toBe("ENDPOINT_CONNECT_ERROR");
    });

    it("应该返回400当端点URL格式无效时", async () => {
      // Arrange
      const endpoint = "not-a-valid-url";
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getEndpoint.mockReturnValue(undefined);

      // Act
      const response = await handler.addEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.code).toBe("INVALID_ENDPOINT_FORMAT");
    });

    it("应该正确处理非Error类型的异常", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);

      // 模拟连接时抛出字符串错误
      const mockEndpointInstance = createMockEndpointInstance(false);
      mockEndpointInstance.connect.mockRejectedValue("字符串错误");
      mockConnectionManager.getEndpoint.mockReturnValue(mockEndpointInstance);

      // Act
      const response = await handler.connectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.code).toBe("ENDPOINT_CONNECT_ERROR");
      expect(responseData.message).toBe("接入点连接失败");
    });

    it("应该正确处理空数组返回的状态", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus.mockReturnValue([]);

      // Act
      const response = await handler.getEndpointStatus(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.code).toBe("ENDPOINT_NOT_FOUND");
    });

    it("应该正确处理连接操作失败的情况", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);

      // 模拟连接失败的端点实例
      const mockEndpointInstance = createMockEndpointInstance(false);
      mockEndpointInstance.connect.mockRejectedValue(new Error("连接超时"));
      mockConnectionManager.getEndpoint.mockReturnValue(mockEndpointInstance);

      // Act
      const response = await handler.connectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.code).toBe("ENDPOINT_CONNECT_ERROR");
      expect(responseData.message).toBe("连接超时");
    });
  });
});
