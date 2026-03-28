import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationService } from "@/services/notification.service.js";
import type { StatusService } from "@/services/status.service.js";
import { HeartbeatHandler } from "../heartbeat.handler.js";

/**
 * Mock 服务类型定义
 */
interface MockStatusService extends Partial<StatusService> {
  updateClientInfo: ReturnType<typeof vi.fn>;
  getLastHeartbeat: ReturnType<typeof vi.fn>;
  isClientConnected: ReturnType<typeof vi.fn>;
}

interface MockNotificationService extends Partial<NotificationService> {
  cleanupDisconnectedClients: ReturnType<typeof vi.fn>;
  getClientStats: ReturnType<typeof vi.fn>;
}

interface MockWebSocket {
  send: ReturnType<typeof vi.fn>;
  readyState?: number;
}

// 模拟依赖
vi.mock("@/Logger.js", () => ({
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

// 模拟定时器
vi.useFakeTimers();

describe("HeartbeatHandler", () => {
  let heartbeatHandler: HeartbeatHandler;
  let mockStatusService: MockStatusService;
  let mockNotificationService: MockNotificationService;
  let mockConfigService: {
    getConfig: ReturnType<typeof vi.fn>;
  };
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };
  let mockWebSocket: MockWebSocket;

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

    // 模拟 Logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };
    const { logger } = await import("@/Logger.js");
    Object.assign(logger, mockLogger);

    // 模拟 ConfigManager
    mockConfigService = {
      getConfig: vi.fn().mockReturnValue(mockConfig),
    };
    const { configManager } = await import("@xiaozhi-client/config");
    Object.assign(configManager, mockConfigService);

    // 模拟 StatusService
    mockStatusService = {
      updateClientInfo: vi.fn(),
      getLastHeartbeat: vi.fn(),
      isClientConnected: vi.fn(),
    };

    // 模拟 NotificationService
    mockNotificationService = {
      cleanupDisconnectedClients: vi.fn(),
      getClientStats: vi.fn(),
    };

    // 模拟 WebSocket
    mockWebSocket = {
      send: vi.fn(),
      readyState: 1, // WebSocket.OPEN
    };

    heartbeatHandler = new HeartbeatHandler(
      mockStatusService as unknown as StatusService,
      mockNotificationService as unknown as NotificationService
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  describe("constructor", () => {
    it("应该使用正确的依赖项初始化", () => {
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

    it("应该成功处理客户端状态更新", async () => {
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

    it("应该处理状态服务错误", async () => {
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

    it("应该处理非 Error 异常", async () => {
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

    it("应该优雅地处理配置服务错误", async () => {
      const configError = new Error("Config fetch failed");
      mockConfigService.getConfig.mockImplementation(() => {
        throw configError;
      });

      await heartbeatHandler.handleClientStatus(
        mockWebSocket,
        mockHeartbeatMessage,
        clientId
      );

      // 仍然应该成功更新状态
      expect(mockStatusService.updateClientInfo).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `客户端状态更新成功: ${clientId}`
      );

      // 应该记录配置错误，但不应该导致心跳失败
      expect(mockLogger.error).toHaveBeenCalledWith(
        `发送最新配置失败: ${clientId}`,
        configError
      );
    });

    it("应该处理配置更新中的 WebSocket 发送错误", async () => {
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

  describe("checkHeartbeatTimeout", () => {
    beforeEach(() => {
      vi.spyOn(Date, "now").mockReturnValue(1234567890);
    });

    it("在没有心跳时不应该触发超时", () => {
      mockStatusService.getLastHeartbeat.mockReturnValue(undefined);

      heartbeatHandler.checkHeartbeatTimeout();

      expect(mockStatusService.updateClientInfo).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it("在心跳最近时不应该触发超时", () => {
      const recentHeartbeat = 1234567890 - 30000; // 30 秒前
      mockStatusService.getLastHeartbeat.mockReturnValue(recentHeartbeat);

      heartbeatHandler.checkHeartbeatTimeout();

      expect(mockStatusService.updateClientInfo).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it("在心跳过旧时应该触发超时", () => {
      const oldHeartbeat = 1234567890 - 40000; // 40 秒前（> 35 秒超时）
      mockStatusService.getLastHeartbeat.mockReturnValue(oldHeartbeat);

      heartbeatHandler.checkHeartbeatTimeout();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "客户端心跳超时，标记为断开连接"
      );
      expect(mockStatusService.updateClientInfo).toHaveBeenCalledWith(
        { status: "disconnected" },
        "heartbeat-timeout"
      );
    });

    it("应该处理精确超时边界", () => {
      const exactTimeoutHeartbeat = 1234567890 - 35000; // 正好 35 秒前
      mockStatusService.getLastHeartbeat.mockReturnValue(exactTimeoutHeartbeat);

      heartbeatHandler.checkHeartbeatTimeout();

      // 在精确边界时不应该触发超时
      expect(mockStatusService.updateClientInfo).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it("应该处理超时边界 + 1ms", () => {
      const timeoutHeartbeat = 1234567890 - 35001; // 35.001 秒前
      mockStatusService.getLastHeartbeat.mockReturnValue(timeoutHeartbeat);

      heartbeatHandler.checkHeartbeatTimeout();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "客户端心跳超时，标记为断开连接"
      );
      expect(mockStatusService.updateClientInfo).toHaveBeenCalledWith(
        { status: "disconnected" },
        "heartbeat-timeout"
      );
    });
  });

  describe("startHeartbeatMonitoring", () => {
    it("应该以正确的时间间隔启动心跳监控", () => {
      const setIntervalSpy = vi.spyOn(global, "setInterval");

      const intervalId = heartbeatHandler.startHeartbeatMonitoring();

      expect(mockLogger.debug).toHaveBeenCalledWith("启动心跳监控");
      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        10000 // 10 秒
      );
      expect(intervalId).toBeDefined();
    });

    it("应该在时间间隔执行监控任务", () => {
      mockStatusService.getLastHeartbeat.mockReturnValue(undefined);
      mockNotificationService.cleanupDisconnectedClients.mockImplementation(
        () => {}
      );

      heartbeatHandler.startHeartbeatMonitoring();

      // 快进时间以触发间隔
      vi.advanceTimersByTime(10000);

      expect(mockStatusService.getLastHeartbeat).toHaveBeenCalled();
      expect(
        mockNotificationService.cleanupDisconnectedClients
      ).toHaveBeenCalled();
    });

    it("应该优雅地处理清理错误", () => {
      const cleanupError = new Error("Cleanup failed");
      mockNotificationService.cleanupDisconnectedClients.mockImplementation(
        () => {
          throw cleanupError;
        }
      );

      heartbeatHandler.startHeartbeatMonitoring();

      // 快进时间以触发间隔
      vi.advanceTimersByTime(10000);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "清理断开连接的客户端失败:",
        cleanupError
      );
    });
  });

  describe("stopHeartbeatMonitoring", () => {
    it("应该停止心跳监控", () => {
      const clearIntervalSpy = vi.spyOn(global, "clearInterval");
      const mockIntervalId = 12345 as any;

      heartbeatHandler.stopHeartbeatMonitoring(mockIntervalId);

      expect(mockLogger.debug).toHaveBeenCalledWith("停止心跳监控");
      expect(clearIntervalSpy).toHaveBeenCalledWith(mockIntervalId);
    });
  });

  describe("getHeartbeatStats", () => {
    it("应该返回心跳统计信息", () => {
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

    it("应该处理未定义的最后一次心跳", () => {
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

    it("应该处理客户端连接", () => {
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

    it("应该处理客户端断开连接", () => {
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

    it("应该成功发送心跳响应", () => {
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

    it("应该处理 WebSocket 发送错误", () => {
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
    it("应该验证正确的心跳消息", () => {
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

    it("应该验证最小心跳消息", () => {
      const minimalMessage = {
        type: "clientStatus",
        data: {},
      };

      const result = heartbeatHandler.validateHeartbeatMessage(minimalMessage);

      expect(result).toBe(true);
    });

    it("应该拒绝 null 消息", () => {
      const result = heartbeatHandler.validateHeartbeatMessage(null);

      expect(result).toBeFalsy();
    });

    it("应该拒绝 undefined 消息", () => {
      const result = heartbeatHandler.validateHeartbeatMessage(undefined);

      expect(result).toBeFalsy();
    });

    it("应该拒绝非对象消息", () => {
      const result = heartbeatHandler.validateHeartbeatMessage("invalid");

      expect(result).toBe(false);
    });

    it("应该拒绝类型错误的消息", () => {
      const invalidMessage = {
        type: "wrongType",
        data: {},
      };

      const result = heartbeatHandler.validateHeartbeatMessage(invalidMessage);

      expect(result).toBe(false);
    });

    it("应该拒绝没有 data 的消息", () => {
      const invalidMessage = {
        type: "clientStatus",
      };

      const result = heartbeatHandler.validateHeartbeatMessage(invalidMessage);

      expect(result).toBeFalsy();
    });

    it("应该拒绝 data 为非对象的消息", () => {
      const invalidMessage = {
        type: "clientStatus",
        data: "invalid",
      };

      const result = heartbeatHandler.validateHeartbeatMessage(invalidMessage);

      expect(result).toBe(false);
    });

    it("应该拒绝 data 为 null 的消息", () => {
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

    it("应该处理完整的客户端生命周期", async () => {
      // 客户端连接
      heartbeatHandler.handleClientConnect(clientId);
      expect(mockStatusService.updateClientInfo).toHaveBeenCalledWith(
        {
          status: "connected",
          lastHeartbeat: 1234567890,
        },
        `websocket-connect-${clientId}`
      );

      // 客户端发送心跳
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

      // 发送心跳响应
      heartbeatHandler.sendHeartbeatResponse(mockWebSocket, clientId);
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"heartbeatResponse"')
      );

      // 客户端断开连接
      heartbeatHandler.handleClientDisconnect(clientId);
      expect(mockStatusService.updateClientInfo).toHaveBeenCalledWith(
        { status: "disconnected" },
        `websocket-disconnect-${clientId}`
      );
    });

    it("应该处理监控工作流程", () => {
      // 启动监控
      const intervalId = heartbeatHandler.startHeartbeatMonitoring();
      expect(mockLogger.debug).toHaveBeenCalledWith("启动心跳监控");

      // 模拟监控周期
      mockStatusService.getLastHeartbeat.mockReturnValue(1234567890 - 40000);
      vi.advanceTimersByTime(10000);

      expect(mockStatusService.updateClientInfo).toHaveBeenCalledWith(
        { status: "disconnected" },
        "heartbeat-timeout"
      );
      expect(
        mockNotificationService.cleanupDisconnectedClients
      ).toHaveBeenCalled();

      // 停止监控
      heartbeatHandler.stopHeartbeatMonitoring(intervalId);
      expect(mockLogger.debug).toHaveBeenCalledWith("停止心跳监控");
    });

    it("应该处理混合成功和错误场景", async () => {
      // 第一次心跳成功
      await heartbeatHandler.handleClientStatus(
        mockWebSocket,
        mockHeartbeatMessage,
        clientId
      );
      expect(mockStatusService.updateClientInfo).toHaveBeenCalled();

      // 第二次心跳因状态服务错误而失败
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

      // 第三次心跳再次成功
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

    it("应该处理具有最小数据的心跳消息", async () => {
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

    it("应该处理包含所有可选字段的心跳消息", async () => {
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

    it("应该处理非常长的客户端 ID", async () => {
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

    it("应该处理客户端 ID 中的特殊字符", async () => {
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

    it("应该处理空的客户端 ID", async () => {
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

    it("应该处理大量活动的 MCP 服务器", async () => {
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

    it("应该处理 Date.now() 返回边缘值", () => {
      // 测试时间戳为 0
      vi.spyOn(Date, "now").mockReturnValue(0);
      heartbeatHandler.handleClientConnect(clientId);
      expect(mockStatusService.updateClientInfo).toHaveBeenCalledWith(
        {
          status: "connected",
          lastHeartbeat: 0,
        },
        `websocket-connect-${clientId}`
      );

      // 测试最大安全整数
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

    it("应该处理并发心跳处理", async () => {
      const promises: Promise<void>[] = [];

      // 模拟并发心跳消息
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

    it("应该处理快速定时器推进的监控", () => {
      mockStatusService.getLastHeartbeat.mockReturnValue(1234567890 - 40000);

      heartbeatHandler.startHeartbeatMonitoring();

      // 快速多次推进定时器
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(10000);
      }

      // 应该被调用 5 次
      expect(mockStatusService.updateClientInfo).toHaveBeenCalledTimes(5);
      expect(
        mockNotificationService.cleanupDisconnectedClients
      ).toHaveBeenCalledTimes(5);
    });
  });
});
