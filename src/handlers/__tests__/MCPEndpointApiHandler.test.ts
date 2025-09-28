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
  };

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create handler instance
    const { configManager } = await import("../../configManager.js");
    handler = new MCPEndpointApiHandler(mockConnectionManager as any, configManager);

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
      mockContext.req.param.mockReturnValue("ws://localhost:3000");
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);

      // Act
      const response = await handler.getEndpointStatus(mockContext);

      // Assert
      expect(response).toBeDefined();
      expect(mockConnectionManager.getConnectionStatus).toHaveBeenCalled();
    });

    it("应该返回404当接入点不存在时", async () => {
      // Arrange
      mockContext.req.param.mockReturnValue("ws://nonexistent:3000");
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);

      // Act
      const response = await handler.getEndpointStatus(mockContext);

      // Assert
      expect(response.status).toBe(404);
    });

    it("应该返回400当端点参数无效时", async () => {
      // Arrange
      mockContext.req.param.mockReturnValue("");

      // Act
      const response = await handler.getEndpointStatus(mockContext);

      // Assert
      expect(response.status).toBe(400);
    });
  });

  describe("connectEndpoint", () => {
    it("应该成功连接已存在的接入点", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      mockContext.req.param.mockReturnValue(endpoint);

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
        })
      );
    });

    it("应该返回404当接入点不存在时", async () => {
      // Arrange
      mockContext.req.param.mockReturnValue("ws://nonexistent:3000");
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);

      // Act
      const response = await handler.connectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(404);
    });

    it("应该返回409当接入点已连接时", async () => {
      // Arrange
      const connectedStatus = { ...mockEndpointStatus, connected: true };
      mockContext.req.param.mockReturnValue("ws://localhost:3000");
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        connectedStatus,
      ]);

      // Act
      const response = await handler.connectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(409);
    });
  });

  describe("disconnectEndpoint", () => {
    it("应该成功断开已连接的接入点", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      const connectedStatus = { ...mockEndpointStatus, connected: true };
      mockContext.req.param.mockReturnValue(endpoint);
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
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "endpoint:status:changed",
        expect.objectContaining({
          endpoint,
          connected: false,
          operation: "disconnect",
          success: true,
        })
      );
    });

    it("应该返回404当接入点不存在时", async () => {
      // Arrange
      mockContext.req.param.mockReturnValue("ws://nonexistent:3000");
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);

      // Act
      const response = await handler.disconnectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(404);
    });

    it("应该返回409当接入点未连接时", async () => {
      // Arrange
      mockContext.req.param.mockReturnValue("ws://localhost:3000");
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);

      // Act
      const response = await handler.disconnectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(409);
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
      expect(mockConnectionManager.addEndpoint).toHaveBeenCalledWith(endpoint);
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "endpoint:status:changed",
        expect.objectContaining({
          endpoint,
          connected: false,
          operation: "add",
          success: true,
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
    });

    it("应该返回400当端点参数无效时", async () => {
      // Arrange
      const requestBody = { endpoint: null };
      mockContext.req.json.mockResolvedValue(requestBody);

      // Act
      const response = await handler.addEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(400);
    });
  });

  describe("removeEndpoint", () => {
    it("应该成功移除接入点", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      mockContext.req.param.mockReturnValue(endpoint);
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);
      mockConnectionManager.removeEndpoint.mockResolvedValue(undefined);

      // Act
      const response = await handler.removeEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(200);
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
        })
      );
    });

    it("应该先断开连接再移除已连接的接入点", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      const connectedStatus = { ...mockEndpointStatus, connected: true };
      mockContext.req.param.mockReturnValue(endpoint);
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
      mockContext.req.param.mockReturnValue("ws://nonexistent:3000");
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);

      // Act
      const response = await handler.removeEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(404);
    });
  });

  describe("reconnectEndpoint", () => {
    it("应该成功重连接入点", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      mockContext.req.param.mockReturnValue(endpoint);
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);
      mockConnectionManager.triggerReconnect.mockResolvedValue(undefined);
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        {
          ...mockEndpointStatus,
          connected: true,
        },
      ]);

      // Act
      const response = await handler.reconnectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(200);
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
        })
      );
    });

    it("应该先断开已连接的接入点再重连", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      const connectedStatus = { ...mockEndpointStatus, connected: true };
      mockContext.req.param.mockReturnValue(endpoint);
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
      mockContext.req.param.mockReturnValue("ws://nonexistent:3000");
      mockConnectionManager.getConnectionStatus.mockReturnValue([
        mockEndpointStatus,
      ]);

      // Act
      const response = await handler.reconnectEndpoint(mockContext);

      // Assert
      expect(response.status).toBe(404);
    });
  });

  describe("错误处理", () => {
    it("应该正确处理并返回500错误当连接管理器抛出异常时", async () => {
      // Arrange
      const endpoint = "ws://localhost:3000";
      mockContext.req.param.mockReturnValue(endpoint);
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
    });
  });
});
