import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HeartbeatHandler } from "../heartbeat.handler.js";

// Mock dependencies
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@xiaozhi-client/config", () => ({
  configManager: {
    getConfig: vi.fn(),
  },
}));

// Mock timers
vi.useFakeTimers();

describe("HeartbeatHandler", () => {
  let heartbeatHandler: HeartbeatHandler;
  let mockStatusService: any;
  let mockNotificationService: any;
  let mockConfigService: any;
  let mockLogger: any;
  let mockWebSocket: any;

  const mockConfig = {
    mcpEndpoint: "ws://localhost:3000",
    mcpServers: {
      calculator: {
        command: "node",
        args: ["calculator.js"],
      },
    },
    connection: {
      heartbeatInterval: 30000,
      heartbeatTimeout: 35000,
      reconnectInterval: 5000,
    },
  };

  const mockHeartbeatMessage = {
    type: "clientStatus" as const,
    data: {
      status: "connected" as const,
      mcpEndpoint: "ws://localhost:3000",
      activeMCPServers: ["calculator", "datetime"],
      timestamp: 1234567890,
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.clearAllTimers();

    // Mock Logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };
    const { logger } = await import("../../Logger.js");
    Object.assign(logger, mockLogger);

    // Mock ConfigManager
    mockConfigService = {
      getConfig: vi.fn().mockReturnValue(mockConfig),
    };
    const { configManager } = await import("@xiaozhi-client/config");
    Object.assign(configManager, mockConfigService);

    // Mock StatusService
    mockStatusService = {
      updateClientInfo: vi.fn(),
      getLastHeartbeat: vi.fn(),
      isClientConnected: vi.fn(),
    };

    // Mock NotificationService
    mockNotificationService = {
      cleanupDisconnectedClients: vi.fn(),
      getClientStats: vi.fn(),
    };

    // Mock WebSocket
    mockWebSocket = {
      send: vi.fn(),
      readyState: 1, // WebSocket.OPEN
    };

    heartbeatHandler = new HeartbeatHandler(
      mockStatusService,
      mockNotificationService
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  describe("constructor", () => {
    it("should initialize with correct dependencies", () => {
      expect(heartbeatHandler).toBeInstanceOf(HeartbeatHandler);
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });

  describe("handleClientStatus", () => {
    const clientId = "test-client-123";

    beforeEach(() => {
      mockConfigService.getConfig.mockReturnValue(mockConfig);
      vi.spyOn(Date, "now").mockReturnValue(1234567890);
    });

    it("should handle client status update successfully", async () => {
      await heartbeatHandler.handleClientStatus(
        mockWebSocket,
        mockHeartbeatMessage,
        clientId
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `处理客户端状态更新: ${clientId}`,
        mockHeartbeatMessage.data
      );

      expect(mockStatusService.updateClientInfo).toHaveBeenCalledWith(
        {
          ...mockHeartbeatMessage.data,
          lastHeartbeat: 1234567890,
        },
        `websocket-${clientId}`
      );

      expect(mockConfigService.getConfig).toHaveBeenCalledTimes(1);
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "configUpdate",
          data: mockConfig,
          timestamp: 1234567890,
        })
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `客户端状态更新成功: ${clientId}`
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `最新配置已发送给客户端: ${clientId}`
      );
    });

    it("should handle status service error", async () => {
      const error = new Error("Status update failed");
      mockStatusService.updateClientInfo.mockImplementation(() => {
        throw error;
      });

      await heartbeatHandler.handleClientStatus(
        mockWebSocket,
        mockHeartbeatMessage,
        clientId
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        `处理客户端状态更新失败: ${clientId}`,
        error
      );

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "error",
          error: {
            code: "CLIENT_STATUS_ERROR",
            message: "Status update failed",
            timestamp: 1234567890,
          },
        })
      );
    });

    it("should handle non-Error exceptions", async () => {
      mockStatusService.updateClientInfo.mockImplementation(() => {
        throw "String error";
      });

      await heartbeatHandler.handleClientStatus(
        mockWebSocket,
        mockHeartbeatMessage,
        clientId
      );

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "error",
          error: {
            code: "CLIENT_STATUS_ERROR",
            message: "客户端状态更新失败",
            timestamp: 1234567890,
          },
        })
      );
    });

    it("should handle config service error gracefully", async () => {
      const configError = new Error("Config fetch failed");
      mockConfigService.getConfig.mockImplementation(() => {
        throw configError;
      });

      await heartbeatHandler.handleClientStatus(
        mockWebSocket,
        mockHeartbeatMessage,
        clientId
      );

      // Should still update status successfully
      expect(mockStatusService.updateClientInfo).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `客户端状态更新成功: ${clientId}`
      );

      // Should log config error but not fail the heartbeat
      expect(mockLogger.error).toHaveBeenCalledWith(
        `发送最新配置失败: ${clientId}`,
        configError
      );
    });

    it("should handle WebSocket send error in config update", async () => {
      const sendError = new Error("WebSocket send failed");
      mockWebSocket.send.mockImplementation(() => {
        throw sendError;
      });

      await heartbeatHandler.handleClientStatus(
        mockWebSocket,
        mockHeartbeatMessage,
        clientId
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        `发送最新配置失败: ${clientId}`,
        sendError
      );
    });
  });

  describe("sendError", () => {
    const clientId = "test-client-123";

    beforeEach(() => {
      vi.spyOn(Date, "now").mockReturnValue(1234567890);
    });

    it("should send error message successfully", () => {
      // Access private method through type assertion for testing
      const handler = heartbeatHandler as any;
      handler.sendError(mockWebSocket, "TEST_ERROR", "Test error message");

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "error",
          error: {
            code: "TEST_ERROR",
            message: "Test error message",
            timestamp: 1234567890,
          },
        })
      );
    });

    it("should handle WebSocket send error", () => {
      const sendError = new Error("WebSocket send failed");
      mockWebSocket.send.mockImplementation(() => {
        throw sendError;
      });

      const handler = heartbeatHandler as any;
      handler.sendError(mockWebSocket, "TEST_ERROR", "Test error message");

      expect(mockLogger.error).toHaveBeenCalledWith(
        "发送错误消息失败:",
        sendError
      );
    });
  });

  describe("checkHeartbeatTimeout", () => {
    beforeEach(() => {
      vi.spyOn(Date, "now").mockReturnValue(1234567890);
    });

    it("should not trigger timeout when no heartbeat exists", () => {
      mockStatusService.getLastHeartbeat.mockReturnValue(undefined);

      heartbeatHandler.checkHeartbeatTimeout();

      expect(mockStatusService.updateClientInfo).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it("should not trigger timeout when heartbeat is recent", () => {
      const recentHeartbeat = 1234567890 - 30000; // 30 seconds ago
      mockStatusService.getLastHeartbeat.mockReturnValue(recentHeartbeat);

      heartbeatHandler.checkHeartbeatTimeout();

      expect(mockStatusService.updateClientInfo).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it("should trigger timeout when heartbeat is old", () => {
      const oldHeartbeat = 1234567890 - 40000; // 40 seconds ago (> 35s timeout)
      mockStatusService.getLastHeartbeat.mockReturnValue(oldHeartbeat);

      heartbeatHandler.checkHeartbeatTimeout();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "客户端心跳超时，标记为断开连接"
      );
      expect(mockStatusService.updateClientInfo).toHaveBeenCalledWith(
        { status: "disconnected" },
        "heartbeat-timeout"
      );
    });

    it("should handle exact timeout boundary", () => {
      const exactTimeoutHeartbeat = 1234567890 - 35000; // Exactly 35 seconds ago
      mockStatusService.getLastHeartbeat.mockReturnValue(exactTimeoutHeartbeat);

      heartbeatHandler.checkHeartbeatTimeout();

      // Should not trigger timeout at exact boundary
      expect(mockStatusService.updateClientInfo).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it("should handle timeout boundary + 1ms", () => {
      const timeoutHeartbeat = 1234567890 - 35001; // 35.001 seconds ago
      mockStatusService.getLastHeartbeat.mockReturnValue(timeoutHeartbeat);

      heartbeatHandler.checkHeartbeatTimeout();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "客户端心跳超时，标记为断开连接"
      );
      expect(mockStatusService.updateClientInfo).toHaveBeenCalledWith(
        { status: "disconnected" },
        "heartbeat-timeout"
      );
    });
  });

  describe("startHeartbeatMonitoring", () => {
    it("should start heartbeat monitoring with correct interval", () => {
      const setIntervalSpy = vi.spyOn(global, "setInterval");

      const intervalId = heartbeatHandler.startHeartbeatMonitoring();

      expect(mockLogger.debug).toHaveBeenCalledWith("启动心跳监控");
      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        10000 // 10 seconds
      );
      expect(intervalId).toBeDefined();
    });

    it("should execute monitoring tasks on interval", () => {
      mockStatusService.getLastHeartbeat.mockReturnValue(undefined);
      mockNotificationService.cleanupDisconnectedClients.mockImplementation(
        () => {}
      );

      heartbeatHandler.startHeartbeatMonitoring();

      // Fast-forward time to trigger interval
      vi.advanceTimersByTime(10000);

      expect(mockStatusService.getLastHeartbeat).toHaveBeenCalled();
      expect(
        mockNotificationService.cleanupDisconnectedClients
      ).toHaveBeenCalled();
    });

    it("should handle cleanup error gracefully", () => {
      const cleanupError = new Error("Cleanup failed");
      mockNotificationService.cleanupDisconnectedClients.mockImplementation(
        () => {
          throw cleanupError;
        }
      );

      heartbeatHandler.startHeartbeatMonitoring();

      // Fast-forward time to trigger interval
      vi.advanceTimersByTime(10000);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "清理断开连接的客户端失败:",
        cleanupError
      );
    });
  });

  describe("stopHeartbeatMonitoring", () => {
    it("should stop heartbeat monitoring", () => {
      const clearIntervalSpy = vi.spyOn(global, "clearInterval");
      const mockIntervalId = 12345 as any;

      heartbeatHandler.stopHeartbeatMonitoring(mockIntervalId);

      expect(mockLogger.debug).toHaveBeenCalledWith("停止心跳监控");
      expect(clearIntervalSpy).toHaveBeenCalledWith(mockIntervalId);
    });
  });

  describe("getHeartbeatStats", () => {
    it("should return heartbeat statistics", () => {
      const mockStats = {
        totalClients: 5,
        connectedClients: 3,
        queuedMessages: 10,
      };

      mockStatusService.getLastHeartbeat.mockReturnValue(1234567890);
      mockStatusService.isClientConnected.mockReturnValue(true);
      mockNotificationService.getClientStats.mockReturnValue(mockStats);

      const stats = heartbeatHandler.getHeartbeatStats();

      expect(stats).toEqual({
        lastHeartbeat: 1234567890,
        isConnected: true,
        clientStats: mockStats,
      });
    });

    it("should handle undefined last heartbeat", () => {
      const mockStats = {
        totalClients: 0,
        connectedClients: 0,
        queuedMessages: 0,
      };

      mockStatusService.getLastHeartbeat.mockReturnValue(undefined);
      mockStatusService.isClientConnected.mockReturnValue(false);
      mockNotificationService.getClientStats.mockReturnValue(mockStats);

      const stats = heartbeatHandler.getHeartbeatStats();

      expect(stats).toEqual({
        lastHeartbeat: undefined,
        isConnected: false,
        clientStats: mockStats,
      });
    });
  });

  describe("handleClientConnect", () => {
    const clientId = "test-client-123";

    beforeEach(() => {
      vi.spyOn(Date, "now").mockReturnValue(1234567890);
    });

    it("should handle client connection", () => {
      heartbeatHandler.handleClientConnect(clientId);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `客户端连接建立: ${clientId}`
      );
      expect(mockStatusService.updateClientInfo).toHaveBeenCalledWith(
        {
          status: "connected",
          lastHeartbeat: 1234567890,
        },
        `websocket-connect-${clientId}`
      );
    });
  });

  describe("handleClientDisconnect", () => {
    const clientId = "test-client-123";

    it("should handle client disconnection", () => {
      heartbeatHandler.handleClientDisconnect(clientId);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `客户端连接断开: ${clientId}`
      );
      expect(mockStatusService.updateClientInfo).toHaveBeenCalledWith(
        { status: "disconnected" },
        `websocket-disconnect-${clientId}`
      );
    });
  });

  describe("sendHeartbeatResponse", () => {
    const clientId = "test-client-123";

    beforeEach(() => {
      vi.spyOn(Date, "now").mockReturnValue(1234567890);
    });

    it("should send heartbeat response successfully", () => {
      heartbeatHandler.sendHeartbeatResponse(mockWebSocket, clientId);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "heartbeatResponse",
          data: {
            timestamp: 1234567890,
            status: "ok",
          },
        })
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `心跳响应已发送: ${clientId}`
      );
    });

    it("should handle WebSocket send error", () => {
      const sendError = new Error("WebSocket send failed");
      mockWebSocket.send.mockImplementation(() => {
        throw sendError;
      });

      heartbeatHandler.sendHeartbeatResponse(mockWebSocket, clientId);

      expect(mockLogger.error).toHaveBeenCalledWith(
        `发送心跳响应失败: ${clientId}`,
        sendError
      );
    });
  });

  describe("validateHeartbeatMessage", () => {
    it("should validate correct heartbeat message", () => {
      const validMessage = {
        type: "clientStatus",
        data: {
          status: "connected",
          mcpEndpoint: "ws://localhost:3000",
          activeMCPServers: ["calculator"],
          timestamp: 1234567890,
        },
      };

      const result = heartbeatHandler.validateHeartbeatMessage(validMessage);

      expect(result).toBe(true);
    });

    it("should validate minimal heartbeat message", () => {
      const minimalMessage = {
        type: "clientStatus",
        data: {},
      };

      const result = heartbeatHandler.validateHeartbeatMessage(minimalMessage);

      expect(result).toBe(true);
    });

    it("should reject null message", () => {
      const result = heartbeatHandler.validateHeartbeatMessage(null);

      expect(result).toBeFalsy();
    });

    it("should reject undefined message", () => {
      const result = heartbeatHandler.validateHeartbeatMessage(undefined);

      expect(result).toBeFalsy();
    });

    it("should reject non-object message", () => {
      const result = heartbeatHandler.validateHeartbeatMessage("invalid");

      expect(result).toBe(false);
    });

    it("should reject message with wrong type", () => {
      const invalidMessage = {
        type: "wrongType",
        data: {},
      };

      const result = heartbeatHandler.validateHeartbeatMessage(invalidMessage);

      expect(result).toBe(false);
    });

    it("should reject message without data", () => {
      const invalidMessage = {
        type: "clientStatus",
      };

      const result = heartbeatHandler.validateHeartbeatMessage(invalidMessage);

      expect(result).toBeFalsy();
    });

    it("should reject message with non-object data", () => {
      const invalidMessage = {
        type: "clientStatus",
        data: "invalid",
      };

      const result = heartbeatHandler.validateHeartbeatMessage(invalidMessage);

      expect(result).toBe(false);
    });

    it("should reject message with null data", () => {
      const invalidMessage = {
        type: "clientStatus",
        data: null,
      };

      const result = heartbeatHandler.validateHeartbeatMessage(invalidMessage);

      expect(result).toBeFalsy();
    });
  });

  describe("integration scenarios", () => {
    const clientId = "test-client-123";

    beforeEach(() => {
      vi.spyOn(Date, "now").mockReturnValue(1234567890);
      mockConfigService.getConfig.mockReturnValue(mockConfig);
    });

    it("should handle complete client lifecycle", async () => {
      // Client connects
      heartbeatHandler.handleClientConnect(clientId);
      expect(mockStatusService.updateClientInfo).toHaveBeenCalledWith(
        {
          status: "connected",
          lastHeartbeat: 1234567890,
        },
        `websocket-connect-${clientId}`
      );

      // Client sends heartbeat
      await heartbeatHandler.handleClientStatus(
        mockWebSocket,
        mockHeartbeatMessage,
        clientId
      );
      expect(mockStatusService.updateClientInfo).toHaveBeenCalledWith(
        {
          ...mockHeartbeatMessage.data,
          lastHeartbeat: 1234567890,
        },
        `websocket-${clientId}`
      );

      // Send heartbeat response
      heartbeatHandler.sendHeartbeatResponse(mockWebSocket, clientId);
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"heartbeatResponse"')
      );

      // Client disconnects
      heartbeatHandler.handleClientDisconnect(clientId);
      expect(mockStatusService.updateClientInfo).toHaveBeenCalledWith(
        { status: "disconnected" },
        `websocket-disconnect-${clientId}`
      );
    });

    it("should handle monitoring workflow", () => {
      // Start monitoring
      const intervalId = heartbeatHandler.startHeartbeatMonitoring();
      expect(mockLogger.debug).toHaveBeenCalledWith("启动心跳监控");

      // Simulate monitoring cycle
      mockStatusService.getLastHeartbeat.mockReturnValue(1234567890 - 40000);
      vi.advanceTimersByTime(10000);

      expect(mockStatusService.updateClientInfo).toHaveBeenCalledWith(
        { status: "disconnected" },
        "heartbeat-timeout"
      );
      expect(
        mockNotificationService.cleanupDisconnectedClients
      ).toHaveBeenCalled();

      // Stop monitoring
      heartbeatHandler.stopHeartbeatMonitoring(intervalId);
      expect(mockLogger.debug).toHaveBeenCalledWith("停止心跳监控");
    });

    it("should handle mixed success and error scenarios", async () => {
      // First heartbeat succeeds
      await heartbeatHandler.handleClientStatus(
        mockWebSocket,
        mockHeartbeatMessage,
        clientId
      );
      expect(mockStatusService.updateClientInfo).toHaveBeenCalled();

      // Second heartbeat fails due to status service error
      const error = new Error("Status service failed");
      mockStatusService.updateClientInfo.mockImplementationOnce(() => {
        throw error;
      });

      await heartbeatHandler.handleClientStatus(
        mockWebSocket,
        mockHeartbeatMessage,
        clientId
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        `处理客户端状态更新失败: ${clientId}`,
        error
      );

      // Third heartbeat succeeds again
      mockStatusService.updateClientInfo.mockImplementation(() => {});
      await heartbeatHandler.handleClientStatus(
        mockWebSocket,
        mockHeartbeatMessage,
        clientId
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `客户端状态更新成功: ${clientId}`
      );
    });
  });

  describe("edge cases and boundary conditions", () => {
    const clientId = "test-client-123";

    beforeEach(() => {
      vi.spyOn(Date, "now").mockReturnValue(1234567890);
      mockConfigService.getConfig.mockReturnValue(mockConfig);
    });

    it("should handle heartbeat message with minimal data", async () => {
      const minimalMessage = {
        type: "clientStatus" as const,
        data: {},
      };

      await heartbeatHandler.handleClientStatus(
        mockWebSocket,
        minimalMessage,
        clientId
      );

      expect(mockStatusService.updateClientInfo).toHaveBeenCalledWith(
        { lastHeartbeat: 1234567890 },
        `websocket-${clientId}`
      );
    });

    it("should handle heartbeat message with all optional fields", async () => {
      const fullMessage = {
        type: "clientStatus" as const,
        data: {
          status: "connected" as const,
          mcpEndpoint: "ws://localhost:3000",
          activeMCPServers: ["calculator", "datetime", "weather"],
          timestamp: 9876543210,
        },
      };

      await heartbeatHandler.handleClientStatus(
        mockWebSocket,
        fullMessage,
        clientId
      );

      expect(mockStatusService.updateClientInfo).toHaveBeenCalledWith(
        {
          ...fullMessage.data,
          lastHeartbeat: 1234567890,
        },
        `websocket-${clientId}`
      );
    });

    it("should handle very long client ID", async () => {
      const longClientId = "a".repeat(1000);

      await heartbeatHandler.handleClientStatus(
        mockWebSocket,
        mockHeartbeatMessage,
        longClientId
      );

      expect(mockStatusService.updateClientInfo).toHaveBeenCalledWith(
        expect.any(Object),
        `websocket-${longClientId}`
      );
    });

    it("should handle special characters in client ID", async () => {
      const specialClientId = "client-123_测试@#$%^&*()";

      await heartbeatHandler.handleClientStatus(
        mockWebSocket,
        mockHeartbeatMessage,
        specialClientId
      );

      expect(mockStatusService.updateClientInfo).toHaveBeenCalledWith(
        expect.any(Object),
        `websocket-${specialClientId}`
      );
    });

    it("should handle empty client ID", async () => {
      const emptyClientId = "";

      await heartbeatHandler.handleClientStatus(
        mockWebSocket,
        mockHeartbeatMessage,
        emptyClientId
      );

      expect(mockStatusService.updateClientInfo).toHaveBeenCalledWith(
        expect.any(Object),
        "websocket-"
      );
    });

    it("should handle large number of active MCP servers", async () => {
      const largeServerList = Array.from(
        { length: 100 },
        (_, i) => `server-${i}`
      );
      const messageWithManyServers = {
        type: "clientStatus" as const,
        data: {
          status: "connected" as const,
          activeMCPServers: largeServerList,
        },
      };

      await heartbeatHandler.handleClientStatus(
        mockWebSocket,
        messageWithManyServers,
        clientId
      );

      expect(mockStatusService.updateClientInfo).toHaveBeenCalledWith(
        {
          ...messageWithManyServers.data,
          lastHeartbeat: 1234567890,
        },
        `websocket-${clientId}`
      );
    });

    it("should handle Date.now() returning edge values", () => {
      // Test with timestamp 0
      vi.spyOn(Date, "now").mockReturnValue(0);
      heartbeatHandler.handleClientConnect(clientId);
      expect(mockStatusService.updateClientInfo).toHaveBeenCalledWith(
        {
          status: "connected",
          lastHeartbeat: 0,
        },
        `websocket-connect-${clientId}`
      );

      // Test with maximum safe integer
      vi.spyOn(Date, "now").mockReturnValue(Number.MAX_SAFE_INTEGER);
      heartbeatHandler.handleClientConnect(clientId);
      expect(mockStatusService.updateClientInfo).toHaveBeenCalledWith(
        {
          status: "connected",
          lastHeartbeat: Number.MAX_SAFE_INTEGER,
        },
        `websocket-connect-${clientId}`
      );
    });

    it("should handle concurrent heartbeat processing", async () => {
      const promises: Promise<void>[] = [];

      // Simulate concurrent heartbeat messages
      for (let i = 0; i < 10; i++) {
        promises.push(
          heartbeatHandler.handleClientStatus(
            mockWebSocket,
            mockHeartbeatMessage,
            `client-${i}`
          )
        );
      }

      await Promise.all(promises);

      expect(mockStatusService.updateClientInfo).toHaveBeenCalledTimes(10);
      expect(mockConfigService.getConfig).toHaveBeenCalledTimes(10);
    });

    it("should handle monitoring with rapid timer advances", () => {
      mockStatusService.getLastHeartbeat.mockReturnValue(1234567890 - 40000);

      heartbeatHandler.startHeartbeatMonitoring();

      // Rapidly advance timers multiple times
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(10000);
      }

      // Should have been called 5 times
      expect(mockStatusService.updateClientInfo).toHaveBeenCalledTimes(5);
      expect(
        mockNotificationService.cleanupDisconnectedClients
      ).toHaveBeenCalledTimes(5);
    });
  });
});
