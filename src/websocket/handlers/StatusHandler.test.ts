/**
 * StatusHandler 测试
 * 测试状态消息处理器的功能
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../../configManager.js";
import { WebSocketMessageType } from "../types.js";
import { type ClientInfo, StatusHandler } from "./StatusHandler.js";

// Mock configManager
vi.mock("../../configManager.js", () => ({
  configManager: {
    getConfig: vi.fn(),
  },
}));

// Mock logger
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("StatusHandler", () => {
  let statusHandler: StatusHandler;
  let mockWebSocket: any;
  let mockBroadcastCallback: ReturnType<typeof vi.fn>;
  let mockConfigManager: any;

  beforeEach(async () => {
    statusHandler = new StatusHandler();
    mockBroadcastCallback = vi.fn();

    // 获取 mock configManager 引用
    const configManagerModule = await import("../../configManager.js");
    mockConfigManager = configManagerModule.configManager;

    // 设置广播回调
    statusHandler.setBroadcastCallback(mockBroadcastCallback);

    // Mock WebSocket
    mockWebSocket = {
      send: vi.fn(),
      readyState: 1, // WebSocket.OPEN
    };

    // 重置所有 mock
    vi.clearAllMocks();
  });

  afterEach(() => {
    statusHandler.cleanup();
    vi.clearAllMocks();
  });

  describe("canHandle", () => {
    it("应该能够处理 getStatus 消息", () => {
      expect(statusHandler.canHandle(WebSocketMessageType.GET_STATUS)).toBe(
        true
      );
    });

    it("应该能够处理 clientStatus 消息", () => {
      expect(statusHandler.canHandle(WebSocketMessageType.CLIENT_STATUS)).toBe(
        true
      );
    });

    it("应该不能处理其他类型的消息", () => {
      expect(statusHandler.canHandle(WebSocketMessageType.GET_CONFIG)).toBe(
        false
      );
      expect(
        statusHandler.canHandle(WebSocketMessageType.RESTART_SERVICE)
      ).toBe(false);
      expect(statusHandler.canHandle("unknown")).toBe(false);
    });
  });

  describe("handle", () => {
    it("应该处理 getStatus 消息", async () => {
      const message = {
        type: WebSocketMessageType.GET_STATUS,
      };

      await statusHandler.handle(mockWebSocket, message);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"status"')
      );
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"status":"disconnected"')
      );
    });

    it("应该处理 clientStatus 消息", async () => {
      const mockConfig: AppConfig = {
        mcpEndpoint: "http://localhost:3000",
        mcpServers: {},
        connection: {},
        modelscope: {},
        webUI: {},
        mcpServerConfig: {},
      };

      mockConfigManager.getConfig.mockReturnValue(mockConfig);

      const statusData: Partial<ClientInfo> = {
        status: "connected",
        mcpEndpoint: "http://localhost:4000",
        activeMCPServers: ["server1", "server2"],
      };

      const message = {
        type: WebSocketMessageType.CLIENT_STATUS,
        data: statusData,
      };

      await statusHandler.handle(mockWebSocket, message);

      // 验证状态更新广播
      expect(mockBroadcastCallback).toHaveBeenCalledWith({
        type: WebSocketMessageType.STATUS_UPDATE,
        data: expect.objectContaining({
          status: "connected",
          mcpEndpoint: "http://localhost:4000",
          activeMCPServers: ["server1", "server2"],
        }),
      });

      // 验证配置更新发送
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: WebSocketMessageType.CONFIG_UPDATE,
          data: mockConfig,
        })
      );
    });

    it("应该处理无效的状态数据", async () => {
      const message = {
        type: WebSocketMessageType.CLIENT_STATUS,
        data: null,
      };

      await statusHandler.handle(mockWebSocket, message);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"error":"无效的状态数据"')
      );
    });

    it("应该处理未知消息类型", async () => {
      const message = {
        type: "unknown",
      };

      await statusHandler.handle(mockWebSocket, message);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"error":"未知消息类型: unknown"')
      );
    });

    it("应该处理获取状态时的错误", async () => {
      // Mock WebSocket.send 抛出错误
      mockWebSocket.send.mockImplementation(() => {
        throw new Error("发送失败");
      });

      const message = {
        type: WebSocketMessageType.GET_STATUS,
      };

      await statusHandler.handle(mockWebSocket, message);

      // 应该不会抛出错误，只是记录日志
      expect(mockWebSocket.send).toHaveBeenCalled();
    });
  });

  describe("客户端信息管理", () => {
    it("应该正确更新客户端信息", async () => {
      const statusData: Partial<ClientInfo> = {
        status: "connected",
        mcpEndpoint: "http://localhost:5000",
        activeMCPServers: ["test-server"],
      };

      const message = {
        type: WebSocketMessageType.CLIENT_STATUS,
        data: statusData,
      };

      await statusHandler.handle(mockWebSocket, message);

      const clientInfo = statusHandler.getClientInfo();
      expect(clientInfo.status).toBe("connected");
      expect(clientInfo.mcpEndpoint).toBe("http://localhost:5000");
      expect(clientInfo.activeMCPServers).toEqual(["test-server"]);
    });

    it("应该在设置 lastHeartbeat 时更新为当前时间", async () => {
      const beforeTime = Date.now();

      const statusData: Partial<ClientInfo> = {
        lastHeartbeat: 123456789, // 这个值会被忽略，使用当前时间
      };

      const message = {
        type: WebSocketMessageType.CLIENT_STATUS,
        data: statusData,
      };

      await statusHandler.handle(mockWebSocket, message);

      const clientInfo = statusHandler.getClientInfo();
      const afterTime = Date.now();

      expect(clientInfo.lastHeartbeat).toBeGreaterThanOrEqual(beforeTime);
      expect(clientInfo.lastHeartbeat).toBeLessThanOrEqual(afterTime);
    });

    it("应该保持现有信息不变", async () => {
      // 先设置初始信息
      statusHandler.setClientConnected("http://localhost:3000", ["server1"]);

      // 只更新部分信息
      const statusData: Partial<ClientInfo> = {
        status: "disconnected",
      };

      const message = {
        type: WebSocketMessageType.CLIENT_STATUS,
        data: statusData,
      };

      await statusHandler.handle(mockWebSocket, message);

      const clientInfo = statusHandler.getClientInfo();
      expect(clientInfo.status).toBe("disconnected");
      expect(clientInfo.mcpEndpoint).toBe("http://localhost:3000"); // 保持不变
      expect(clientInfo.activeMCPServers).toEqual(["server1"]); // 保持不变
    });
  });

  describe("getClientInfo", () => {
    it("应该返回客户端信息的副本", () => {
      const originalInfo = statusHandler.getClientInfo();
      originalInfo.status = "connected"; // 修改返回的对象

      const newInfo = statusHandler.getClientInfo();
      expect(newInfo.status).toBe("disconnected"); // 原始对象不应该被修改
    });
  });

  describe("setClientConnected", () => {
    it("应该设置客户端为连接状态", () => {
      const beforeTime = Date.now();

      statusHandler.setClientConnected("http://localhost:6000", [
        "server1",
        "server2",
      ]);

      const clientInfo = statusHandler.getClientInfo();
      const afterTime = Date.now();

      expect(clientInfo.status).toBe("connected");
      expect(clientInfo.mcpEndpoint).toBe("http://localhost:6000");
      expect(clientInfo.activeMCPServers).toEqual(["server1", "server2"]);
      expect(clientInfo.lastHeartbeat).toBeGreaterThanOrEqual(beforeTime);
      expect(clientInfo.lastHeartbeat).toBeLessThanOrEqual(afterTime);
    });

    it("应该使用默认的空服务器列表", () => {
      statusHandler.setClientConnected("http://localhost:7000");

      const clientInfo = statusHandler.getClientInfo();
      expect(clientInfo.activeMCPServers).toEqual([]);
    });
  });

  describe("setClientDisconnected", () => {
    it("应该设置客户端为断开连接状态", () => {
      // 先设置为连接状态
      statusHandler.setClientConnected("http://localhost:3000", ["server1"]);

      // 设置为断开连接
      statusHandler.setClientDisconnected();

      const clientInfo = statusHandler.getClientInfo();
      expect(clientInfo.status).toBe("disconnected");
      // 其他信息应该保持不变
      expect(clientInfo.mcpEndpoint).toBe("http://localhost:3000");
      expect(clientInfo.activeMCPServers).toEqual(["server1"]);
    });
  });

  describe("resetClientStatus", () => {
    it("应该重置客户端状态为断开连接", () => {
      // 先设置为连接状态
      statusHandler.setClientConnected("http://localhost:3000", ["server1"]);

      // 重置状态
      statusHandler.resetClientStatus();

      const clientInfo = statusHandler.getClientInfo();
      expect(clientInfo.status).toBe("disconnected");
      expect(clientInfo.lastHeartbeat).toBeUndefined();
    });
  });

  describe("sendInitialStatus", () => {
    it("应该发送初始状态数据", async () => {
      await statusHandler.sendInitialStatus(mockWebSocket);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"status"')
      );
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"status":"disconnected"')
      );
    });

    it("应该处理发送初始状态时的错误", async () => {
      mockWebSocket.send.mockImplementation(() => {
        throw new Error("发送失败");
      });

      await statusHandler.sendInitialStatus(mockWebSocket);

      // 应该不会抛出错误，只是记录日志
      expect(mockWebSocket.send).toHaveBeenCalled();
    });
  });

  describe("setBroadcastCallback", () => {
    it("应该正确设置广播回调", async () => {
      const newCallback = vi.fn();
      statusHandler.setBroadcastCallback(newCallback);

      const statusData: Partial<ClientInfo> = {
        status: "connected",
      };

      const message = {
        type: WebSocketMessageType.CLIENT_STATUS,
        data: statusData,
      };

      await statusHandler.handle(mockWebSocket, message);

      expect(newCallback).toHaveBeenCalledWith({
        type: WebSocketMessageType.STATUS_UPDATE,
        data: expect.objectContaining({
          status: "connected",
        }),
      });
    });
  });

  describe("心跳超时机制", () => {
    it("应该在连接状态下重置心跳超时", async () => {
      vi.useFakeTimers();

      const statusData: Partial<ClientInfo> = {
        status: "connected",
      };

      const message = {
        type: WebSocketMessageType.CLIENT_STATUS,
        data: statusData,
      };

      await statusHandler.handle(mockWebSocket, message);

      // 验证心跳超时被设置
      expect(statusHandler.getClientInfo().status).toBe("connected");

      // 快进时间，但不超过超时时间
      vi.advanceTimersByTime(25000); // 25秒

      expect(statusHandler.getClientInfo().status).toBe("connected");

      vi.useRealTimers();
    });

    it("应该在心跳超时后标记为断开连接", async () => {
      vi.useFakeTimers();

      const statusData: Partial<ClientInfo> = {
        status: "connected",
      };

      const message = {
        type: WebSocketMessageType.CLIENT_STATUS,
        data: statusData,
      };

      await statusHandler.handle(mockWebSocket, message);

      // 快进时间超过超时时间
      vi.advanceTimersByTime(35000); // 35秒，超过30秒超时

      expect(statusHandler.getClientInfo().status).toBe("disconnected");
      expect(mockBroadcastCallback).toHaveBeenCalledWith({
        type: WebSocketMessageType.STATUS_UPDATE,
        data: expect.objectContaining({
          status: "disconnected",
        }),
      });

      vi.useRealTimers();
    });
  });

  describe("cleanup", () => {
    it("应该清理心跳超时", () => {
      // 设置连接状态以创建心跳超时
      statusHandler.setClientConnected("http://localhost:3000");

      // 清理资源
      statusHandler.cleanup();

      // 验证清理后不会有超时触发
      // 这里主要是确保不会抛出错误
      expect(() => statusHandler.cleanup()).not.toThrow();
    });
  });
});
