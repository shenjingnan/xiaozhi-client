import { Hono } from "hono";
import type { Context } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectionStatus } from "../../services/IndependentXiaozhiConnectionManager.js";
import { MCPEndpointApiHandler } from "../MCPEndpointApiHandler.js";

// Mock dependencies
vi.mock("../../Logger.js", () => ({
  logger: {
    withTag: vi.fn().mockReturnValue({
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    }),
  },
}));

vi.mock("../../services/EventBus.js", () => ({
  getEventBus: vi.fn().mockReturnValue({
    emitEvent: vi.fn(),
  }),
}));

vi.mock("../../configManager.js", () => ({
  configManager: {
    getMcpEndpoints: vi.fn(),
    addMcpEndpoint: vi.fn(),
    removeMcpEndpoint: vi.fn(),
  },
}));

// Mock IndependentXiaozhiConnectionManager
const mockConnectionManager = {
  getConnectionStatus: vi.fn(),
  connectExistingEndpoint: vi.fn(),
  disconnectEndpoint: vi.fn(),
  triggerReconnect: vi.fn(),
  addEndpoint: vi.fn(),
  removeEndpoint: vi.fn(),
};

describe("MCPEndpointApiHandler", () => {
  let handler: MCPEndpointApiHandler;
  let mockContext: any;
  let mockEventBus: any;

  const mockEndpointStatus: ConnectionStatus = {
    endpoint: "ws://localhost:3000",
    connected: false,
    initialized: true,
    isReconnecting: false,
    reconnectAttempts: 0,
    nextReconnectTime: undefined,
    reconnectDelay: 0,
    lastError: undefined,
    lastConnected: undefined,
  };

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create handler instance
    const { configManager } = await import("../../configManager.js");
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
      expect(response.status).toBe(404);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("ENDPOINT_NOT_FOUND");
    });

    it("应该返回400当端点参数无效时", async () => {
      // Arrange
      mockContext.req.json.mockResolvedValue({ endpoint: "" });

      // Act
      const response = await handler.getEndpointStatus(mockContext);

      // Assert
      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("INVALID_ENDPOINT");
    });

    it("应该返回400当端点参数为null时", async () => {
      // Arrange
      mockContext.req.json.mockResolvedValue({ endpoint: null });

      // Act
      const response = await handler.getEndpointStatus(mockContext);

      // Assert
      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("INVALID_ENDPOINT");
    });

    it("应该返回400当端点参数为undefined时", async () => {
      // Arrange
      mockContext.req.json.mockResolvedValue({ endpoint: undefined });

      // Act
      const response = await handler.getEndpointStatus(mockContext);

      // Assert
      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("INVALID_ENDPOINT");
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
      expect(responseData.error.code).toBe("ENDPOINT_STATUS_READ_ERROR");
    });
  });

  describe("connectEndpoint", () => {
    it("应该成功连接已存在的接入点", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      mockContext.req.json.mockResolvedValue({ endpoint });

      // 设置初始状态（未连接）
      mockConnectionManager.getConnectionStatus.mockReturnValueOnce([
        mockEndpointStatus,
      ]);

      // 模拟连接成功
      mockConnectionManager.connectExistingEndpoint.mockResolvedValue(
        undefined
      );

      // 设置连接后的状态（已连接）
      const connectedStatus = { ...mockEndpointStatus, connected: true };
      mockConnectionManager.getConnectionStatus.mockReturnValueOnce([
        connectedStatus,
      ]);

      // Act
      const response = await handler.connectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(200);
      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.data).toEqual(connectedStatus);
      expect(
        mockConnectionManager.connectExistingEndpoint
      ).toHaveBeenCalledWith(endpoint);
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
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);

      // Act
      const response = await handler.connectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(404);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("ENDPOINT_NOT_FOUND");
      expect(responseData.error.message).toBe("端点不存在，请先添加接入点");
    });

    it("应该返回409当接入点已连接时", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      const connectedStatus = { ...mockEndpointStatus, connected: true };
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        connectedStatus,
      ]);

      // Act
      const response = await handler.connectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(409);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("ENDPOINT_ALREADY_CONNECTED");
      expect(responseData.error.message).toBe("端点已连接");
    });

    it("应该返回400当端点参数无效时", async () => {
      // Arrange
      mockContext.req.json.mockResolvedValue({ endpoint: "" });

      // Act
      const response = await handler.connectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("INVALID_ENDPOINT");
    });

    it("应该返回500当连接操作失败时", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);
      mockConnectionManager.connectExistingEndpoint.mockRejectedValue(
        new Error("连接失败")
      );

      // Act
      const response = await handler.connectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("ENDPOINT_CONNECT_ERROR");
      expect(responseData.error.message).toBe("连接失败");
    });

    it("应该返回500当连接后无法获取状态时", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus
        .mockReturnValueOnce([mockEndpointStatus])
        .mockReturnValueOnce([]);

      mockConnectionManager.connectExistingEndpoint.mockResolvedValue(
        undefined
      );

      // Act
      const response = await handler.connectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("ENDPOINT_STATUS_NOT_FOUND");
    });

    it("应该正确处理URL编码的端点地址", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000/api";
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus
        .mockReturnValueOnce([{ ...mockEndpointStatus, endpoint }])
        .mockReturnValueOnce([
          { ...mockEndpointStatus, endpoint, connected: true },
        ]);

      mockConnectionManager.connectExistingEndpoint.mockResolvedValue(
        undefined
      );

      // Act
      const response = await handler.connectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(200);
      expect(
        mockConnectionManager.connectExistingEndpoint
      ).toHaveBeenCalledWith(endpoint);
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
      mockConnectionManager.disconnectEndpoint.mockResolvedValue(undefined);

      // Act
      const response = await handler.disconnectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(200);
      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(mockConnectionManager.disconnectEndpoint).toHaveBeenCalledWith(
        endpoint
      );
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
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);

      // Act
      const response = await handler.disconnectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(404);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("ENDPOINT_NOT_FOUND");
    });

    it("应该返回409当接入点未连接时", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);

      // Act
      const response = await handler.disconnectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(409);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("ENDPOINT_NOT_CONNECTED");
      expect(responseData.error.message).toBe("端点未连接");
    });

    it("应该返回400当端点参数无效时", async () => {
      // Arrange
      mockContext.req.json.mockResolvedValue({ endpoint: "" });

      // Act
      const response = await handler.disconnectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("INVALID_ENDPOINT");
    });

    it("应该返回500当断开操作失败时", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      const connectedStatus = { ...mockEndpointStatus, connected: true };
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        connectedStatus,
      ]);
      mockConnectionManager.disconnectEndpoint.mockRejectedValue(
        new Error("断开失败")
      );

      // Act
      const response = await handler.disconnectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("ENDPOINT_DISCONNECT_ERROR");
      expect(responseData.error.message).toBe("断开失败");
    });

    it("应该使用fallback状态当断开后无法获取状态时", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      const connectedStatus = { ...mockEndpointStatus, connected: true };
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus
        .mockReturnValueOnce([connectedStatus])
        .mockReturnValueOnce([]);
      mockConnectionManager.disconnectEndpoint.mockResolvedValue(undefined);

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
          isReconnecting: false,
          reconnectAttempts: 0,
          reconnectDelay: 0,
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
      mockConnectionManager.disconnectEndpoint.mockResolvedValue(undefined);

      // Act
      const response = await handler.disconnectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(200);
      expect(mockConnectionManager.disconnectEndpoint).toHaveBeenCalledWith(
        endpoint
      );
    });
  });

  describe("addEndpoint", () => {
    it("应该成功添加新接入点", async () => {
      // Arrange
      const endpoint = "ws://new-endpoint:3000";
      const requestBody = { endpoint };
      mockContext.req.json.mockResolvedValue(requestBody);

      // 设置初始状态（不包含新端点）
      mockConnectionManager.getConnectionStatus.mockReturnValueOnce([
        mockEndpointStatus,
      ]);

      // 模拟添加成功
      mockConnectionManager.addEndpoint.mockResolvedValue(undefined);

      // 设置添加后的状态（包含新端点）
      const newEndpointStatus = { ...mockEndpointStatus, endpoint };
      mockConnectionManager.getConnectionStatus.mockReturnValueOnce([
        mockEndpointStatus,
        newEndpointStatus,
      ]);

      // Act
      const response = await handler.addEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(200);
      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(mockConnectionManager.addEndpoint).toHaveBeenCalledWith(endpoint);
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "endpoint:status:changed",
        expect.objectContaining({
          endpoint,
          connected: false,
          operation: "add",
          success: true,
          message: "接入点添加成功",
          timestamp: expect.any(Number),
          source: "http-api",
        })
      );
    });

    it("应该返回409当接入点已存在时", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      const requestBody = { endpoint };
      mockContext.req.json.mockResolvedValue(requestBody);
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);

      // Act
      const response = await handler.addEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(409);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("ENDPOINT_ALREADY_EXISTS");
      expect(responseData.error.message).toBe("接入点已存在");
    });

    it("应该返回400当端点参数无效时", async () => {
      // Arrange
      const requestBody = { endpoint: null };
      mockContext.req.json.mockResolvedValue(requestBody);

      // Act
      const response = await handler.addEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("INVALID_ENDPOINT");
    });

    it("应该返回400当端点参数为空字符串时", async () => {
      // Arrange
      const requestBody = { endpoint: "" };
      mockContext.req.json.mockResolvedValue(requestBody);

      // Act
      const response = await handler.addEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("INVALID_ENDPOINT");
    });

    it("应该返回409当接入点已存在于配置文件中时", async () => {
      // Arrange
      const endpoint = "ws://existing-endpoint:3000";
      const requestBody = { endpoint };
      mockContext.req.json.mockResolvedValue(requestBody);
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);
      mockConnectionManager.addEndpoint.mockRejectedValue(
        new Error("端点已存在于配置文件中")
      );

      // Act
      const response = await handler.addEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(409);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("ENDPOINT_ALREADY_IN_CONFIG");
    });

    it("应该返回400当端点必须是非空字符串错误时", async () => {
      // Arrange
      const endpoint = "   ";
      const requestBody = { endpoint };
      mockContext.req.json.mockResolvedValue(requestBody);
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);
      mockConnectionManager.addEndpoint.mockRejectedValue(
        new Error("端点必须是非空字符串")
      );

      // Act
      const response = await handler.addEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("INVALID_ENDPOINT");
    });

    it("应该返回500当添加操作失败时", async () => {
      // Arrange
      const endpoint = "ws://new-endpoint:3000";
      const requestBody = { endpoint };
      mockContext.req.json.mockResolvedValue(requestBody);
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);
      mockConnectionManager.addEndpoint.mockRejectedValue(
        new Error("添加失败")
      );

      // Act
      const response = await handler.addEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("ENDPOINT_ADD_ERROR");
    });

    it("应该返回500当添加后无法获取状态时", async () => {
      // Arrange
      const endpoint = "ws://new-endpoint:3000";
      const requestBody = { endpoint };
      mockContext.req.json.mockResolvedValue(requestBody);
      mockConnectionManager.getConnectionStatus
        .mockReturnValueOnce([mockEndpointStatus])
        .mockReturnValueOnce([mockEndpointStatus]);
      mockConnectionManager.addEndpoint.mockResolvedValue(undefined);

      // Act
      const response = await handler.addEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("ENDPOINT_STATUS_NOT_FOUND");
    });

    it("应该正确处理JSON解析错误", async () => {
      // Arrange
      mockContext.req.json.mockRejectedValue(new Error("JSON解析失败"));

      // Act
      const response = await handler.addEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("ENDPOINT_ADD_ERROR");
    });
  });

  describe("removeEndpoint", () => {
    it("应该成功移除接入点", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);
      mockConnectionManager.removeEndpoint.mockResolvedValue(undefined);

      // Act
      const response = await handler.removeEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(200);
      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(mockConnectionManager.removeEndpoint).toHaveBeenCalledWith(
        endpoint
      );
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "endpoint:status:changed",
        expect.objectContaining({
          endpoint,
          connected: false,
          operation: "remove",
          success: true,
          message: "接入点移除成功",
          timestamp: expect.any(Number),
          source: "http-api",
        })
      );
    });

    it("应该先断开连接再移除已连接的接入点", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      const connectedStatus = { ...mockEndpointStatus, connected: true };
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        connectedStatus,
      ]);
      mockConnectionManager.disconnectEndpoint.mockResolvedValue(undefined);
      mockConnectionManager.removeEndpoint.mockResolvedValue(undefined);

      // Act
      const response = await handler.removeEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(200);
      expect(mockConnectionManager.disconnectEndpoint).toHaveBeenCalledWith(
        endpoint
      );
      expect(mockConnectionManager.removeEndpoint).toHaveBeenCalledWith(
        endpoint
      );
    });

    it("应该返回404当接入点不存在时", async () => {
      // Arrange
      const endpoint = "ws://nonexistent:3000";
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);

      // Act
      const response = await handler.removeEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(404);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("ENDPOINT_NOT_FOUND");
    });

    it("应该返回400当端点参数无效时", async () => {
      // Arrange
      mockContext.req.json.mockResolvedValue({ endpoint: "" });

      // Act
      const response = await handler.removeEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("INVALID_ENDPOINT");
    });

    it("应该返回404当端点不存在错误时", async () => {
      // Arrange
      const endpoint = "ws://nonexistent:3000";
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);
      mockConnectionManager.removeEndpoint.mockRejectedValue(
        new Error("端点不存在")
      );

      // Act
      const response = await handler.removeEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(404);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("ENDPOINT_NOT_FOUND");
    });

    it("应该返回400当端点必须是非空字符串错误时", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);
      mockConnectionManager.removeEndpoint.mockRejectedValue(
        new Error("端点必须是非空字符串")
      );

      // Act
      const response = await handler.removeEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("INVALID_ENDPOINT");
    });

    it("应该返回500当移除操作失败时", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);
      mockConnectionManager.removeEndpoint.mockRejectedValue(
        new Error("移除失败")
      );

      // Act
      const response = await handler.removeEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("ENDPOINT_REMOVE_ERROR");
    });

    it("应该正确处理URL编码的端点地址", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000/api";
      const endpointStatus = {
        ...mockEndpointStatus,
        endpoint,
      };
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        endpointStatus,
      ]);
      mockConnectionManager.removeEndpoint.mockResolvedValue(undefined);

      // Act
      const response = await handler.removeEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(200);
      expect(mockConnectionManager.removeEndpoint).toHaveBeenCalledWith(
        endpoint
      );
    });
  });

  describe("reconnectEndpoint", () => {
    it("应该成功重连接入点", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus
        .mockReturnValueOnce([mockEndpointStatus])
        .mockReturnValueOnce([
          {
            ...mockEndpointStatus,
            connected: true,
          },
        ]);
      mockConnectionManager.triggerReconnect.mockResolvedValue(undefined);

      // Act
      const response = await handler.reconnectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(200);
      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(mockConnectionManager.triggerReconnect).toHaveBeenCalledWith(
        endpoint
      );
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "endpoint:status:changed",
        expect.objectContaining({
          endpoint,
          connected: true,
          operation: "reconnect",
          success: true,
          message: "接入点重连成功",
          timestamp: expect.any(Number),
          source: "http-api",
        })
      );
    });

    it("应该先断开已连接的接入点再重连", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      const connectedStatus = { ...mockEndpointStatus, connected: true };
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        connectedStatus,
      ]);
      mockConnectionManager.disconnectEndpoint.mockResolvedValue(undefined);
      mockConnectionManager.triggerReconnect.mockResolvedValue(undefined);

      // Act
      const response = await handler.reconnectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(200);
      expect(mockConnectionManager.disconnectEndpoint).toHaveBeenCalledWith(
        endpoint
      );
      expect(mockConnectionManager.triggerReconnect).toHaveBeenCalledWith(
        endpoint
      );
    });

    it("应该返回404当接入点不存在时", async () => {
      // Arrange
      const endpoint = "ws://nonexistent:3000";
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);

      // Act
      const response = await handler.reconnectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(404);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("ENDPOINT_NOT_FOUND");
    });

    it("应该返回400当端点参数无效时", async () => {
      // Arrange
      mockContext.req.json.mockResolvedValue({ endpoint: "" });

      // Act
      const response = await handler.reconnectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("INVALID_ENDPOINT");
    });

    it("应该返回500当重连操作失败时", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);
      mockConnectionManager.triggerReconnect.mockRejectedValue(
        new Error("重连失败")
      );

      // Act
      const response = await handler.reconnectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("ENDPOINT_RECONNECT_ERROR");
      expect(responseData.error.message).toBe("重连失败");
    });

    it("应该返回500当重连后无法获取状态时", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus
        .mockReturnValueOnce([mockEndpointStatus])
        .mockReturnValueOnce([]);
      mockConnectionManager.triggerReconnect.mockResolvedValue(undefined);

      // Act
      const response = await handler.reconnectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("ENDPOINT_STATUS_NOT_FOUND");
    });

    it("应该正确处理URL编码的端点地址", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000/api";
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus
        .mockReturnValueOnce([{ ...mockEndpointStatus, endpoint }])
        .mockReturnValueOnce([
          { ...mockEndpointStatus, endpoint, connected: true },
        ]);
      mockConnectionManager.triggerReconnect.mockResolvedValue(undefined);

      // Act
      const response = await handler.reconnectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(200);
      expect(mockConnectionManager.triggerReconnect).toHaveBeenCalledWith(
        endpoint
      );
    });
  });

  describe("边界场景和错误处理", () => {
    it("应该正确处理并返回500错误当连接管理器抛出异常时", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);
      mockConnectionManager.connectExistingEndpoint.mockRejectedValue(
        new Error("连接失败")
      );

      // Act
      const response = await handler.connectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("ENDPOINT_CONNECT_ERROR");
    });

    it("应该正确处理并返回500错误当添加接入点抛出异常时", async () => {
      // Arrange
      const endpoint = "ws://new-endpoint:3000";
      const requestBody = { endpoint };
      mockContext.req.json.mockResolvedValue(requestBody);
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);
      mockConnectionManager.addEndpoint.mockRejectedValue(
        new Error("添加失败")
      );

      // Act
      const response = await handler.addEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("ENDPOINT_ADD_ERROR");
    });

    it("应该正确处理非Error类型的异常", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);
      mockConnectionManager.connectExistingEndpoint.mockRejectedValue(
        "字符串错误"
      );

      // Act
      const response = await handler.connectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("ENDPOINT_CONNECT_ERROR");
      expect(responseData.error.message).toBe("接入点连接失败");
    });

    it("应该正确处理空数组返回的状态", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      mockContext.req.json.mockResolvedValue({ endpoint });
      mockConnectionManager.getConnectionStatus.mockReturnValue([]);

      // Act
      const response = await handler.getEndpointStatus(mockContext);

      // Assert
      expect(response.status).toBe(404);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("ENDPOINT_NOT_FOUND");
    });

    it("应该正确处理连接状态不一致的情况", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      mockContext.req.json.mockResolvedValue({ endpoint });

      // 初始状态显示未连接
      mockConnectionManager.getConnectionStatus.mockReturnValueOnce([
        mockEndpointStatus,
      ]);

      // 但连接操作失败
      mockConnectionManager.connectExistingEndpoint.mockRejectedValue(
        new Error("连接超时")
      );

      // Act
      const response = await handler.connectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.error.code).toBe("ENDPOINT_CONNECT_ERROR");
    });
  });
});
