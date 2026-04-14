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

describe("RealtimeNotificationHandler", () => {
  let realtimeHandler: RealtimeNotificationHandler;
  let mockNotificationService: any;
  let mockStatusService: any;
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
      validateConfig: vi.fn(),
      updateConfig: vi.fn(),
    };
    const { configManager } = await import("@xiaozhi-client/config");
    Object.assign(configManager, mockConfigService);

    // 模拟 NotificationService
    mockNotificationService = {
      registerClient: vi.fn(),
      unregisterClient: vi.fn(),
      sendToClient: vi.fn(),
      broadcast: vi.fn(),
    };

    // 模拟 StatusService
    mockStatusService = {
      getFullStatus: vi.fn().mockReturnValue(mockStatus),
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
  const expectErrorMessage = (ws: any, code: string, message: string) => {
    const sentMessage = JSON.parse(ws.send.mock.calls[0][0]);
    expect(sentMessage.type).toBe("error");
    expect(sentMessage.error.code).toBe(code);
    expect(sentMessage.error.message).toBe(message);
    expect(sentMessage.error.timestamp).toEqual(expect.any(Number));
  };

  describe("constructor", () => {
    it("应该正确初始化依赖项", () => {
      expect(realtimeHandler).toBeInstanceOf(RealtimeNotificationHandler);
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });

  describe("handleMessage", () => {
    const clientId = "test-client-123";

    // 已废弃的消息类型列表
    const deprecatedTypes = [
      "getConfig",
      "updateConfig",
      "getStatus",
      "restartService",
    ];

    describe("已废弃消息类型处理", () => {
      it.each(deprecatedTypes)(
        "应该对 %s 返回废弃提示错误",
        async (messageType) => {
          await realtimeHandler.handleMessage(
            mockWebSocket,
            { type: messageType },
            clientId
          );

          // 验证记录了废弃警告
          expect(mockLogger.warn).toHaveBeenCalledWith(
            `[DEPRECATED] WebSocket 消息类型 "${messageType}" 已废弃，请使用对应的 RESTful API`,
            { clientId }
          );

          // 验证返回了废弃类型错误
          expectErrorMessage(
            mockWebSocket,
            "DEPRECATED_MESSAGE_TYPE",
            `消息类型 "${messageType}" 已废弃，请使用 RESTful API`
          );
        }
      );
    });

    describe("未知消息类型处理", () => {
      it("应该对未知消息类型返回错误", async () => {
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

      it("应该正确处理包含特殊字符的消息类型", async () => {
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

    describe("边界条件", () => {
      it("应该正确处理空客户端 ID", async () => {
        await realtimeHandler.handleMessage(
          mockWebSocket,
          { type: "getConfig" },
          ""
        );

        expect(mockLogger.warn).toHaveBeenCalledWith(
          `[DEPRECATED] WebSocket 消息类型 "getConfig" 已废弃，请使用对应的 RESTful API`,
          { clientId: "" }
        );
      });

      it("应该正确处理超长客户端 ID", async () => {
        const longClientId = "a".repeat(1000);

        await realtimeHandler.handleMessage(
          mockWebSocket,
          { type: "getStatus" },
          longClientId
        );

        expect(mockLogger.warn).toHaveBeenCalledWith(
          `[DEPRECATED] WebSocket 消息类型 "getStatus" 已废弃，请使用对应的 RESTful API`,
          { clientId: longClientId }
        );
      });

      it("应该正确处理 WebSocket 发送失败", async () => {
        mockWebSocket.send.mockImplementation(() => {
          throw new Error("WebSocket send failed");
        });

        // 底层 sendWebSocketError 会捕获发送失败并记录日志
        await realtimeHandler.handleMessage(
          mockWebSocket,
          { type: "getConfig" },
          clientId
        );

        expect(mockLogger.warn).toHaveBeenCalled();
      });
    });
  });

  describe("sendInitialData", () => {
    const clientId = "test-client-123";

    beforeEach(() => {
      mockConfigService.getConfig.mockReturnValue(mockConfig);
      mockStatusService.getFullStatus.mockReturnValue(mockStatus);
    });

    it("应该成功发送初始数据（含重启状态）", async () => {
      await realtimeHandler.sendInitialData(mockWebSocket, clientId);

      expect(mockLogger.debug).toHaveBeenCalledWith("发送初始数据给客户端", {
        clientId,
      });
      expect(mockStatusService.getFullStatus).toHaveBeenCalledTimes(1);

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

    it("应该成功发送初始数据（不含重启状态）", async () => {
      const statusWithoutRestart = {
        client: mockStatus.client,
        restart: null,
      };
      mockStatusService.getFullStatus.mockReturnValue(statusWithoutRestart);

      await realtimeHandler.sendInitialData(mockWebSocket, clientId);

      // 应该只发送状态更新
      expect(mockWebSocket.send).toHaveBeenCalledTimes(1);
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "statusUpdate", data: mockStatus.client })
      );

      // 不应该发送重启状态
      expect(mockWebSocket.send).not.toHaveBeenCalledWith(
        expect.stringContaining("restartStatus")
      );
    });

    it("应该正确处理发送初始数据时的错误", async () => {
      const error = new Error("Initial data failed");
      mockStatusService.getFullStatus.mockImplementation(() => {
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

    it("应该正确处理非 Error 类型的异常", async () => {
      mockStatusService.getFullStatus.mockImplementation(() => {
        throw "String error";
      });

      await realtimeHandler.sendInitialData(mockWebSocket, clientId);

      expectErrorMessage(
        mockWebSocket,
        "INITIAL_DATA_ERROR",
        "发送初始数据失败"
      );
    });

    it("应该正确处理状态服务返回 null 的情况", async () => {
      mockStatusService.getFullStatus.mockReturnValue(null);

      await realtimeHandler.sendInitialData(mockWebSocket, clientId);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "发送初始数据失败:",
        expect.any(Error)
      );
    });

    it("应该正确处理状态服务返回完整数据的情况", async () => {
      mockStatusService.getFullStatus.mockReturnValue(mockStatus);

      await realtimeHandler.sendInitialData(mockWebSocket, clientId);

      // 应该发送状态更新和重启状态
      expect(mockWebSocket.send).toHaveBeenCalledTimes(2);
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "statusUpdate", data: mockStatus.client })
      );
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "restartStatus", data: mockStatus.restart })
      );
    });
  });

  describe("handleClientConnect", () => {
    const clientId = "test-client-123";

    it("应该正确处理客户端连接", () => {
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

    it("应该正确处理客户端断开连接", () => {
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
