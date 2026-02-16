import type { AppConfig } from "@xiaozhi-client/config";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RealtimeNotificationHandler } from "../realtime-notification.handler.js";

// 模拟依赖
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
    updateMcpEndpoint: vi.fn(),
    updateMcpServer: vi.fn(),
    removeMcpServer: vi.fn(),
    updateConnectionConfig: vi.fn(),
    updateModelScopeConfig: vi.fn(),
    updateWebUIConfig: vi.fn(),
    setToolEnabled: vi.fn(),
    updatePlatformConfig: vi.fn(),
    getMcpEndpoint: vi.fn(),
    validateConfig: vi.fn(),
    updateConfig: vi.fn(),
  },
}));

vi.mock("@/services/event-bus.service.js", () => ({
  getEventBus: vi.fn().mockReturnValue({
    emitEvent: vi.fn(),
    onEvent: vi.fn(),
  }),
}));

describe("RealtimeNotificationHandler", () => {
  let realtimeHandler: RealtimeNotificationHandler;
  let mockNotificationService: any;
  let mockStatusService: any;
  let mockConfigService: any;
  let mockEventBus: any;
  let mockLogger: any;
  let mockWebSocket: any;

  const mockConfig: AppConfig = {
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
    webUI: {
      port: 3001,
    },
  };

  const mockStatus = {
    client: {
      status: "connected",
      mcpEndpoint: "ws://localhost:3000",
      activeMCPServers: ["calculator"],
      lastHeartbeat: Date.now(),
    },
    restart: {
      status: "completed",
      timestamp: Date.now(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // 模拟 Logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };
    const { logger } = await import("../../Logger.js");
    Object.assign(logger, mockLogger);

    // 模拟 ConfigManager
    mockConfigService = {
      getConfig: vi.fn().mockReturnValue(mockConfig),
      getMcpEndpoint: vi.fn().mockReturnValue(mockConfig.mcpEndpoint),
      getMcpServers: vi.fn().mockReturnValue(mockConfig.mcpServers),
      updateMcpEndpoint: vi.fn(),
      updateMcpServer: vi.fn(),
      removeMcpServer: vi.fn(),
      updateConnectionConfig: vi.fn(),
      updateModelScopeConfig: vi.fn(),
      updateWebUIConfig: vi.fn(),
      setToolEnabled: vi.fn(),
      updatePlatformConfig: vi.fn(),
      validateConfig: vi.fn(),
      updateConfig: vi.fn(),
    };
    const { configManager } = await import("@xiaozhi-client/config");
    Object.assign(configManager, mockConfigService);

    // 模拟 EventBus
    mockEventBus = {
      emitEvent: vi.fn(),
      onEvent: vi.fn(),
    };
    const { getEventBus } = await import("@/services/event-bus.service.js");
    vi.mocked(getEventBus).mockReturnValue(mockEventBus);

    // 模拟 NotificationService
    mockNotificationService = {
      registerClient: vi.fn(),
      unregisterClient: vi.fn(),
      sendToClient: vi.fn(),
      broadcast: vi.fn(),
    };

    // 模拟 StatusService
    mockStatusService = {
      getFullStatus: vi.fn(),
      updateRestartStatus: vi.fn(),
    };

    // 模拟 WebSocket
    mockWebSocket = {
      send: vi.fn(),
      readyState: 1, // WebSocket.OPEN
    };

    realtimeHandler = new RealtimeNotificationHandler(
      mockNotificationService,
      mockStatusService
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // 辅助函数：验证错误消息
  const expectErrorMessage = (
    mockWebSocket: any,
    code: string,
    message: string
  ) => {
    const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
    expect(sentMessage.type).toBe("error");
    expect(sentMessage.error.code).toBe(code);
    expect(sentMessage.error.message).toBe(message);
    expect(sentMessage.error.timestamp).toEqual(expect.any(Number));
  };

  describe("constructor", () => {
    it("should initialize with correct dependencies", () => {
      expect(realtimeHandler).toBeInstanceOf(RealtimeNotificationHandler);
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });

  describe("handleMessage", () => {
    const clientId = "test-client-123";

    beforeEach(() => {
      mockConfigService.getConfig.mockReturnValue(mockConfig);
      mockConfigService.getMcpEndpoint.mockReturnValue(mockConfig.mcpEndpoint);
      mockConfigService.getMcpServers.mockReturnValue(mockConfig.mcpServers);
      mockStatusService.getFullStatus.mockReturnValue(mockStatus);
    });

    it("should handle getConfig message", async () => {
      await realtimeHandler.handleMessage(
        mockWebSocket,
        { type: "getConfig" },
        clientId
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "处理 WebSocket 消息: getConfig",
        { clientId }
      );
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "websocket:message:received",
        {
          type: "getConfig",
          data: undefined,
          clientId,
        }
      );
      expect(mockConfigService.getConfig).toHaveBeenCalledTimes(1);
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "config", data: mockConfig })
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "[DEPRECATED] WebSocket getConfig 功能已废弃，请使用 GET /api/config 替代"
      );
    });

    it("should handle updateConfig message", async () => {
      const configData = {
        mcpEndpoint: "ws://localhost:4000",
        mcpServers: {},
        connection: {},
        webUI: {},
        mcpServerConfig: {},
        platforms: {},
      } as any;

      await realtimeHandler.handleMessage(
        mockWebSocket,
        { type: "updateConfig", data: configData },
        clientId
      );

      // 验证 validateConfig 被调用
      expect(mockConfigService.validateConfig).toHaveBeenCalledWith(configData);
      // 验证 updateConfig 被调用
      expect(mockConfigService.updateConfig).toHaveBeenCalledWith(configData);
      expect(mockLogger.debug).toHaveBeenCalledWith("WebSocket: 配置更新成功", {
        clientId,
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "[DEPRECATED] WebSocket updateConfig 功能已废弃，请使用 PUT /api/config 替代"
      );
    });

    it("should handle getStatus message", async () => {
      mockStatusService.getFullStatus.mockReturnValue(mockStatus);

      await realtimeHandler.handleMessage(
        mockWebSocket,
        { type: "getStatus" },
        clientId
      );

      expect(mockStatusService.getFullStatus).toHaveBeenCalledTimes(1);
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "status", data: mockStatus.client })
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "WebSocket: getStatus 请求处理成功",
        { clientId }
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "[DEPRECATED] WebSocket getStatus 功能已废弃，请使用 GET /api/status 替代"
      );
    });

    it("should handle restartService message", async () => {
      await realtimeHandler.handleMessage(
        mockWebSocket,
        { type: "restartService" },
        clientId
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        "WebSocket: 收到服务重启请求",
        { clientId }
      );
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "service:restart:requested",
        expect.objectContaining({
          serviceName: "unknown",
          source: `websocket-${clientId}`,
          delay: 0,
          attempt: 1,
          timestamp: expect.any(Number),
        })
      );
      expect(mockStatusService.updateRestartStatus).toHaveBeenCalledWith(
        "restarting"
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "[DEPRECATED] WebSocket restartService 功能已废弃，请使用 POST /api/services/restart 替代"
      );
    });

    it("should handle unknown message type", async () => {
      await realtimeHandler.handleMessage(
        mockWebSocket,
        { type: "unknownType" },
        clientId
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "未知的 WebSocket 消息类型: unknownType",
        { clientId }
      );
      expectErrorMessage(
        mockWebSocket,
        "UNKNOWN_MESSAGE_TYPE",
        "未知的消息类型: unknownType"
      );
    });

    it("should handle message processing error", async () => {
      const error = new Error("Processing failed");
      mockConfigService.getConfig.mockImplementation(() => {
        throw error;
      });

      await realtimeHandler.handleMessage(
        mockWebSocket,
        { type: "getConfig" },
        clientId
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        "WebSocket: getConfig 请求处理失败",
        error
      );
      expectErrorMessage(
        mockWebSocket,
        "CONFIG_READ_ERROR",
        "Processing failed"
      );
    });

    it("should handle non-Error exceptions", async () => {
      mockConfigService.getConfig.mockImplementation(() => {
        throw "String error";
      });

      await realtimeHandler.handleMessage(
        mockWebSocket,
        { type: "getConfig" },
        clientId
      );

      expectErrorMessage(mockWebSocket, "CONFIG_READ_ERROR", "获取配置失败");
    });
  });

  describe("handleGetConfig", () => {
    const clientId = "test-client-123";

    beforeEach(() => {
      mockConfigService.getConfig.mockReturnValue(mockConfig);
    });

    it("should handle getConfig success", async () => {
      // 通过类型断言访问私有方法进行测试
      const handler = realtimeHandler as any;
      await handler.handleGetConfig(mockWebSocket, clientId);

      expect(mockConfigService.getConfig).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "WebSocket: getConfig 请求处理成功",
        { clientId }
      );
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "config", data: mockConfig })
      );
    });

    it("should handle getConfig error", async () => {
      const error = new Error("Config read failed");
      mockConfigService.getConfig.mockImplementation(() => {
        throw error;
      });

      const handler = realtimeHandler as any;
      await handler.handleGetConfig(mockWebSocket, clientId);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "WebSocket: getConfig 请求处理失败",
        error
      );
      expectErrorMessage(
        mockWebSocket,
        "CONFIG_READ_ERROR",
        "Config read failed"
      );
    });

    it("should handle non-Error exceptions in getConfig", async () => {
      mockConfigService.getConfig.mockImplementation(() => {
        throw "String error";
      });

      const handler = realtimeHandler as any;
      await handler.handleGetConfig(mockWebSocket, clientId);

      expectErrorMessage(mockWebSocket, "CONFIG_READ_ERROR", "获取配置失败");
    });
  });

  describe("handleUpdateConfig", () => {
    const clientId = "test-client-123";
    const configData = {
      mcpEndpoint: "ws://localhost:4000",
      mcpServers: {},
      connection: {},
      webUI: {},
      mcpServerConfig: {},
      platforms: {},
    } as any;

    beforeEach(() => {
      mockConfigService.getMcpEndpoint.mockReturnValue("ws://localhost:3000");
      mockConfigService.getMcpServers.mockReturnValue({});
    });

    it("should handle updateConfig success", async () => {
      const handler = realtimeHandler as any;
      await handler.handleUpdateConfig(mockWebSocket, configData, clientId);

      // 验证 validateConfig 被调用
      expect(mockConfigService.validateConfig).toHaveBeenCalledWith(configData);
      // 验证 updateConfig 被调用
      expect(mockConfigService.updateConfig).toHaveBeenCalledWith(configData);
      expect(mockLogger.debug).toHaveBeenCalledWith("WebSocket: 配置更新成功", {
        clientId,
      });
    });

    it("should handle updateConfig error", async () => {
      const error = new Error("Config update failed");
      mockConfigService.validateConfig.mockImplementation(() => {
        throw error;
      });

      const handler = realtimeHandler as any;
      await handler.handleUpdateConfig(mockWebSocket, configData, clientId);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "WebSocket: 配置更新失败",
        error
      );
      expectErrorMessage(
        mockWebSocket,
        "CONFIG_UPDATE_ERROR",
        "Config update failed"
      );
    });

    it("should handle non-Error exceptions in updateConfig", async () => {
      mockConfigService.validateConfig.mockImplementation(() => {
        throw "String error";
      });

      const handler = realtimeHandler as any;
      await handler.handleUpdateConfig(mockWebSocket, configData, clientId);

      expectErrorMessage(mockWebSocket, "CONFIG_UPDATE_ERROR", "String error");
    });
  });

  describe("handleGetStatus", () => {
    const clientId = "test-client-123";

    it("should handle getStatus success", async () => {
      mockStatusService.getFullStatus.mockReturnValue(mockStatus);

      const handler = realtimeHandler as any;
      await handler.handleGetStatus(mockWebSocket, clientId);

      expect(mockStatusService.getFullStatus).toHaveBeenCalledTimes(1);
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "status", data: mockStatus.client })
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "WebSocket: getStatus 请求处理成功",
        { clientId }
      );
    });

    it("should handle getStatus error", async () => {
      const error = new Error("Status read failed");
      mockStatusService.getFullStatus.mockImplementation(() => {
        throw error;
      });

      const handler = realtimeHandler as any;
      await handler.handleGetStatus(mockWebSocket, clientId);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "WebSocket: getStatus 请求处理失败",
        error
      );
      expectErrorMessage(
        mockWebSocket,
        "STATUS_READ_ERROR",
        "Status read failed"
      );
    });

    it("should handle non-Error exceptions in getStatus", async () => {
      mockStatusService.getFullStatus.mockImplementation(() => {
        throw "String error";
      });

      const handler = realtimeHandler as any;
      await handler.handleGetStatus(mockWebSocket, clientId);

      expectErrorMessage(mockWebSocket, "STATUS_READ_ERROR", "获取状态失败");
    });
  });

  describe("handleRestartService", () => {
    const clientId = "test-client-123";

    it("should handle restartService success", async () => {
      const handler = realtimeHandler as any;
      await handler.handleRestartService(mockWebSocket, clientId);

      expect(mockLogger.info).toHaveBeenCalledWith(
        "WebSocket: 收到服务重启请求",
        { clientId }
      );
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "service:restart:requested",
        expect.objectContaining({
          serviceName: "unknown",
          source: `websocket-${clientId}`,
          delay: 0,
          attempt: 1,
          timestamp: expect.any(Number),
        })
      );
      expect(mockStatusService.updateRestartStatus).toHaveBeenCalledWith(
        "restarting"
      );
    });

    it("should handle restartService error", async () => {
      const error = new Error("Restart failed");
      mockStatusService.updateRestartStatus.mockImplementation(() => {
        throw error;
      });

      const handler = realtimeHandler as any;
      await handler.handleRestartService(mockWebSocket, clientId);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "WebSocket: 处理重启请求失败",
        error
      );
      expectErrorMessage(
        mockWebSocket,
        "RESTART_REQUEST_ERROR",
        "Restart failed"
      );
    });

    it("should handle non-Error exceptions in restartService", async () => {
      mockStatusService.updateRestartStatus.mockImplementation(() => {
        throw "String error";
      });

      const handler = realtimeHandler as any;
      await handler.handleRestartService(mockWebSocket, clientId);

      expectErrorMessage(
        mockWebSocket,
        "RESTART_REQUEST_ERROR",
        "处理重启请求失败"
      );
    });
  });

  describe("logDeprecationWarning", () => {
    it("should log deprecation warning", () => {
      const handler = realtimeHandler as any;
      handler.logDeprecationWarning("WebSocket feature", "HTTP API");

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "[DEPRECATED] WebSocket feature 功能已废弃，请使用 HTTP API 替代"
      );
    });
  });

  describe("sendInitialData", () => {
    const clientId = "test-client-123";

    beforeEach(() => {
      mockConfigService.getConfig.mockReturnValue(mockConfig);
      mockStatusService.getFullStatus.mockReturnValue(mockStatus);
    });

    it("should send initial data successfully", async () => {
      await realtimeHandler.sendInitialData(mockWebSocket, clientId);

      expect(mockLogger.debug).toHaveBeenCalledWith("发送初始数据给客户端", {
        clientId,
      });
      expect(mockConfigService.getConfig).toHaveBeenCalledTimes(1);
      expect(mockStatusService.getFullStatus).toHaveBeenCalledTimes(1);

      // 应该发送配置更新
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "configUpdate", data: mockConfig })
      );

      // 应该发送状态更新
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "statusUpdate", data: mockStatus.client })
      );

      // 如果可用，应该发送重启状态
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "restartStatus", data: mockStatus.restart })
      );

      expect(mockLogger.debug).toHaveBeenCalledWith("初始数据发送完成", {
        clientId,
      });
    });

    it("should send initial data without restart status", async () => {
      const statusWithoutRestart = {
        client: mockStatus.client,
        restart: null,
      };
      mockConfigService.getConfig.mockReturnValue(mockConfig);
      mockStatusService.getFullStatus.mockReturnValue(statusWithoutRestart);

      await realtimeHandler.sendInitialData(mockWebSocket, clientId);

      // 应该发送配置和状态更新
      expect(mockWebSocket.send).toHaveBeenCalledTimes(2);
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "configUpdate", data: mockConfig })
      );
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "statusUpdate", data: mockStatus.client })
      );

      // 不应该发送重启状态
      expect(mockWebSocket.send).not.toHaveBeenCalledWith(
        expect.stringContaining("restartStatus")
      );
    });

    it("should handle sendInitialData error", async () => {
      const error = new Error("Initial data failed");
      mockConfigService.getConfig.mockImplementation(() => {
        throw error;
      });

      await realtimeHandler.sendInitialData(mockWebSocket, clientId);

      expect(mockLogger.error).toHaveBeenCalledWith("发送初始数据失败:", error);
      expectErrorMessage(
        mockWebSocket,
        "INITIAL_DATA_ERROR",
        "Initial data failed"
      );
    });

    it("should handle non-Error exceptions in sendInitialData", async () => {
      mockConfigService.getConfig.mockImplementation(() => {
        throw "String error";
      });

      await realtimeHandler.sendInitialData(mockWebSocket, clientId);

      expectErrorMessage(
        mockWebSocket,
        "INITIAL_DATA_ERROR",
        "发送初始数据失败"
      );
    });
  });

  describe("integration scenarios", () => {
    const clientId = "test-client-123";

    it("should handle complete message workflow", async () => {
      // 设置模拟
      mockConfigService.getConfig.mockReturnValue(mockConfig);
      mockStatusService.getFullStatus.mockReturnValue(mockStatus);

      // 测试 getConfig 消息
      await realtimeHandler.handleMessage(
        mockWebSocket,
        { type: "getConfig" },
        clientId
      );

      // 测试 getStatus 消息
      await realtimeHandler.handleMessage(
        mockWebSocket,
        { type: "getStatus" },
        clientId
      );

      // 测试 updateConfig 消息
      const configData = {
        mcpEndpoint: "ws://localhost:4000",
        mcpServers: {},
        connection: {},
        webUI: {},
        mcpServerConfig: {},
        platforms: {},
      } as any;
      mockConfigService.getMcpEndpoint.mockReturnValue("ws://localhost:3000");
      await realtimeHandler.handleMessage(
        mockWebSocket,
        { type: "updateConfig", data: configData },
        clientId
      );

      // 测试 restartService 消息
      await realtimeHandler.handleMessage(
        mockWebSocket,
        { type: "restartService" },
        clientId
      );

      // 验证所有操作都被调用
      expect(mockConfigService.getConfig).toHaveBeenCalledTimes(1);
      expect(mockStatusService.getFullStatus).toHaveBeenCalledTimes(1);
      // 验证 validateConfig 和 updateConfig 被调用
      expect(mockConfigService.validateConfig).toHaveBeenCalledWith(configData);
      expect(mockConfigService.updateConfig).toHaveBeenCalledWith(configData);
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "service:restart:requested",
        expect.objectContaining({
          serviceName: "unknown",
          source: `websocket-${clientId}`,
          delay: 0,
          attempt: 1,
          timestamp: expect.any(Number),
        })
      );
    });

    it("should handle mixed success and error scenarios", async () => {
      // 第一条消息成功
      mockConfigService.getConfig.mockReturnValue(mockConfig);
      await realtimeHandler.handleMessage(
        mockWebSocket,
        { type: "getConfig" },
        clientId
      );

      // 第二条消息失败
      const error = new Error("Status failed");
      mockStatusService.getFullStatus.mockImplementation(() => {
        throw error;
      });
      await realtimeHandler.handleMessage(
        mockWebSocket,
        { type: "getStatus" },
        clientId
      );

      // 第三条消息是未知类型
      await realtimeHandler.handleMessage(
        mockWebSocket,
        { type: "unknownType" },
        clientId
      );

      // 验证成功响应
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "config", data: mockConfig })
      );

      // 验证错误响应
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"code":"STATUS_READ_ERROR"')
      );
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"code":"UNKNOWN_MESSAGE_TYPE"')
      );
    });

    it("should handle sendInitialData with partial failures", async () => {
      // 配置成功，状态失败
      mockConfigService.getConfig.mockReturnValue(mockConfig);
      mockStatusService.getFullStatus.mockImplementation(() => {
        throw new Error("Status failed");
      });

      await realtimeHandler.sendInitialData(mockWebSocket, clientId);

      // 仍应发送错误消息
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"code":"INITIAL_DATA_ERROR"')
      );
    });
  });

  describe("edge cases and boundary conditions", () => {
    const clientId = "test-client-123";

    it("should handle message with null data", async () => {
      mockConfigService.getMcpEndpoint.mockImplementation(() => {
        throw new Error("Cannot read properties of null");
      });

      await realtimeHandler.handleMessage(
        mockWebSocket,
        { type: "updateConfig", data: null },
        clientId
      );

      // 应该优雅地处理错误
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it("should handle message with undefined data", async () => {
      mockConfigService.getMcpEndpoint.mockImplementation(() => {
        throw new Error("Cannot read properties of undefined");
      });

      await realtimeHandler.handleMessage(
        mockWebSocket,
        { type: "updateConfig", data: undefined },
        clientId
      );

      // 应该优雅地处理错误
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it("should handle empty client ID", async () => {
      mockConfigService.getConfig.mockResolvedValue(mockConfig);

      await realtimeHandler.handleMessage(
        mockWebSocket,
        { type: "getConfig" },
        ""
      );

      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "websocket:message:received",
        {
          type: "getConfig",
          data: undefined,
          clientId: "",
        }
      );
    });

    it("should handle WebSocket send failure in message handling", async () => {
      mockConfigService.getConfig.mockResolvedValue(mockConfig);
      mockWebSocket.send.mockImplementation(() => {
        throw new Error("WebSocket send failed");
      });

      await realtimeHandler.handleMessage(
        mockWebSocket,
        { type: "getConfig" },
        clientId
      );

      // 应该记录 WebSocket 发送错误
      expect(mockLogger.error).toHaveBeenCalledWith(
        "发送错误消息失败:",
        expect.any(Error)
      );
    });

    it("should handle status service returning null", async () => {
      mockStatusService.getFullStatus.mockReturnValue(null);

      await realtimeHandler.sendInitialData(mockWebSocket, clientId);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "发送初始数据失败:",
        expect.any(Error)
      );
    });

    it("should handle config service returning null", async () => {
      mockConfigService.getConfig.mockReturnValue({});
      mockStatusService.getFullStatus.mockReturnValue(mockStatus);

      await realtimeHandler.sendInitialData(mockWebSocket, clientId);

      // 应该发送空配置
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "configUpdate", data: {} })
      );
    });

    it("should handle very long client ID", async () => {
      const longClientId = "a".repeat(1000);
      mockConfigService.getConfig.mockReturnValue(mockConfig);

      await realtimeHandler.handleMessage(
        mockWebSocket,
        { type: "getConfig" },
        longClientId
      );

      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "websocket:message:received",
        {
          type: "getConfig",
          data: undefined,
          clientId: longClientId,
        }
      );
    });

    it("should handle message with special characters in type", async () => {
      const specialType = "test-type_123!@#";

      await realtimeHandler.handleMessage(
        mockWebSocket,
        { type: specialType },
        clientId
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        `未知的 WebSocket 消息类型: ${specialType}`,
        { clientId }
      );
    });
  });

  describe("handleClientConnect", () => {
    const clientId = "test-client-123";

    it("should handle client connection", () => {
      realtimeHandler.handleClientConnect(mockWebSocket, clientId);

      expect(mockLogger.debug).toHaveBeenCalledWith(`客户端连接: ${clientId}`);
      expect(mockNotificationService.registerClient).toHaveBeenCalledWith(
        clientId,
        mockWebSocket
      );
    });
  });

  describe("handleClientDisconnect", () => {
    const clientId = "test-client-123";

    it("should handle client disconnection", () => {
      realtimeHandler.handleClientDisconnect(clientId);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `客户端断开连接: ${clientId}`
      );
      expect(mockNotificationService.unregisterClient).toHaveBeenCalledWith(
        clientId
      );
    });
  });
});
