/**
 * WebSocket 消息处理器集成测试
 * 测试消息处理器与 WebSocketManager 的协作
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../../configManager.js";
import { WebSocketMessageType } from "../types.js";
import { ConfigHandler } from "./ConfigHandler.js";
import { ServiceHandler } from "./ServiceHandler.js";
import { StatusHandler } from "./StatusHandler.js";

// Mock configManager
vi.mock("../../configManager.js", () => ({
  configManager: {
    getConfig: vi.fn(),
    getMcpEndpoint: vi.fn(),
    updateMcpEndpoint: vi.fn(),
    getMcpServers: vi.fn(),
    updateMcpServer: vi.fn(),
    removeMcpServer: vi.fn(),
    removeServerToolsConfig: vi.fn(),
    updateConnectionConfig: vi.fn(),
    updateModelScopeConfig: vi.fn(),
    updateWebUIConfig: vi.fn(),
    setToolEnabled: vi.fn(),
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

// Mock child_process
vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

describe("WebSocket 消息处理器集成测试", () => {
  let configHandler: ConfigHandler;
  let statusHandler: StatusHandler;
  let serviceHandler: ServiceHandler;
  let mockWebSocket: any;
  let mockBroadcastCallback: ReturnType<typeof vi.fn>;
  let mockConfigManager: any;
  let mockSpawn: any;

  beforeEach(async () => {
    configHandler = new ConfigHandler();
    statusHandler = new StatusHandler();
    serviceHandler = new ServiceHandler();
    mockBroadcastCallback = vi.fn();

    // 获取 mock configManager 引用
    const configManagerModule = await import("../../configManager.js");
    mockConfigManager = configManagerModule.configManager;

    // 获取 mock spawn 引用
    const childProcessModule = await import("node:child_process");
    mockSpawn = childProcessModule.spawn as any;

    // 设置广播回调
    configHandler.setBroadcastCallback(mockBroadcastCallback);
    statusHandler.setBroadcastCallback(mockBroadcastCallback);
    serviceHandler.setBroadcastCallback(mockBroadcastCallback);

    // 设置服务处理器的容器创建函数
    serviceHandler.setCreateContainer(async () => ({
      get: () => ({
        getStatus: vi.fn().mockResolvedValue({
          running: true,
          mode: "daemon",
        }),
      }),
    }));

    // Mock WebSocket
    mockWebSocket = {
      send: vi.fn(),
      readyState: 1, // WebSocket.OPEN
    };

    // Mock child process
    const mockChild = {
      unref: vi.fn(),
    };
    mockSpawn.mockReturnValue(mockChild);

    // 重置所有 mock
    vi.clearAllMocks();
  });

  afterEach(() => {
    statusHandler.cleanup();
    vi.clearAllMocks();
  });

  describe("消息路由测试", () => {
    it("应该正确路由不同类型的消息到对应的处理器", async () => {
      const mockConfig: AppConfig = {
        mcpEndpoint: "http://localhost:3000",
        mcpServers: {},
        connection: {},
        modelscope: {},
        webUI: {},
        mcpServerConfig: {},
      };

      mockConfigManager.getConfig.mockReturnValue(mockConfig);

      // 测试配置消息路由
      const configMessage = {
        type: WebSocketMessageType.GET_CONFIG,
      };

      expect(configHandler.canHandle(configMessage.type)).toBe(true);
      expect(statusHandler.canHandle(configMessage.type)).toBe(false);
      expect(serviceHandler.canHandle(configMessage.type)).toBe(false);

      await configHandler.handle(mockWebSocket, configMessage);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "config",
          data: mockConfig,
        })
      );

      // 测试状态消息路由
      const statusMessage = {
        type: WebSocketMessageType.GET_STATUS,
      };

      expect(configHandler.canHandle(statusMessage.type)).toBe(false);
      expect(statusHandler.canHandle(statusMessage.type)).toBe(true);
      expect(serviceHandler.canHandle(statusMessage.type)).toBe(false);

      await statusHandler.handle(mockWebSocket, statusMessage);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"status"')
      );

      // 测试服务消息路由
      const serviceMessage = {
        type: WebSocketMessageType.RESTART_SERVICE,
      };

      expect(configHandler.canHandle(serviceMessage.type)).toBe(false);
      expect(statusHandler.canHandle(serviceMessage.type)).toBe(false);
      expect(serviceHandler.canHandle(serviceMessage.type)).toBe(true);

      await serviceHandler.handle(mockWebSocket, serviceMessage);

      expect(mockBroadcastCallback).toHaveBeenCalledWith({
        type: WebSocketMessageType.RESTART_STATUS,
        data: expect.objectContaining({
          status: "restarting",
        }),
      });
    });
  });

  describe("消息处理器协作测试", () => {
    it("应该能够同时处理多个不同类型的消息", async () => {
      const mockConfig: AppConfig = {
        mcpEndpoint: "http://localhost:3000",
        mcpServers: {},
        connection: {},
        modelscope: {},
        webUI: {},
        mcpServerConfig: {},
      };

      mockConfigManager.getConfig.mockReturnValue(mockConfig);
      mockConfigManager.getMcpEndpoint.mockReturnValue("http://localhost:3000");
      mockConfigManager.getMcpServers.mockReturnValue({});

      // 并发处理多个消息
      const messages = [
        configHandler.handle(mockWebSocket, {
          type: WebSocketMessageType.GET_CONFIG,
        }),
        statusHandler.handle(mockWebSocket, {
          type: WebSocketMessageType.GET_STATUS,
        }),
        configHandler.handle(mockWebSocket, {
          type: WebSocketMessageType.UPDATE_CONFIG,
          config: mockConfig,
        }),
        statusHandler.handle(mockWebSocket, {
          type: WebSocketMessageType.CLIENT_STATUS,
          data: {
            status: "connected",
            mcpEndpoint: "http://localhost:4000",
          },
        }),
      ];

      await Promise.all(messages);

      // 验证所有消息都被正确处理
      // getConfig: 1次, getStatus: 1次, clientStatus: 1次 (configUpdate)
      expect(mockWebSocket.send).toHaveBeenCalledTimes(3);
      expect(mockBroadcastCallback).toHaveBeenCalledTimes(2); // 配置更新 + 状态更新
    });
  });

  describe("广播机制测试", () => {
    it("应该正确处理配置更新广播", async () => {
      const newConfig: AppConfig = {
        mcpEndpoint: "http://localhost:4000",
        mcpServers: {},
        connection: {},
        modelscope: {},
        webUI: {},
        mcpServerConfig: {},
      };

      mockConfigManager.getMcpEndpoint.mockReturnValue("http://localhost:3000");
      mockConfigManager.getMcpServers.mockReturnValue({});

      const message = {
        type: WebSocketMessageType.UPDATE_CONFIG,
        config: newConfig,
      };

      await configHandler.handle(mockWebSocket, message);

      expect(mockBroadcastCallback).toHaveBeenCalledWith({
        type: WebSocketMessageType.CONFIG_UPDATE,
        data: newConfig,
      });
    });

    it("应该正确处理状态更新广播", async () => {
      const mockConfig: AppConfig = {
        mcpEndpoint: "http://localhost:3000",
        mcpServers: {},
        connection: {},
        modelscope: {},
        webUI: {},
        mcpServerConfig: {},
      };

      mockConfigManager.getConfig.mockReturnValue(mockConfig);

      const statusData = {
        status: "connected" as const,
        mcpEndpoint: "http://localhost:5000",
        activeMCPServers: ["server1"],
      };

      const message = {
        type: WebSocketMessageType.CLIENT_STATUS,
        data: statusData,
      };

      await statusHandler.handle(mockWebSocket, message);

      expect(mockBroadcastCallback).toHaveBeenCalledWith({
        type: WebSocketMessageType.STATUS_UPDATE,
        data: expect.objectContaining(statusData),
      });
    });

    it("应该正确处理服务重启状态广播", async () => {
      vi.useFakeTimers();

      const message = {
        type: WebSocketMessageType.RESTART_SERVICE,
      };

      const handlePromise = serviceHandler.handle(mockWebSocket, message);

      // 验证重启状态广播
      expect(mockBroadcastCallback).toHaveBeenCalledWith({
        type: WebSocketMessageType.RESTART_STATUS,
        data: {
          status: "restarting",
          error: undefined,
          timestamp: expect.any(Number),
        },
      });

      // 快进时间完成处理
      vi.advanceTimersByTime(500);
      await handlePromise;

      vi.useRealTimers();
    });
  });

  describe("错误处理集成测试", () => {
    it("应该正确处理配置处理器中的错误", async () => {
      mockConfigManager.getConfig.mockImplementation(() => {
        throw new Error("配置读取失败");
      });

      const message = {
        type: WebSocketMessageType.GET_CONFIG,
      };

      await configHandler.handle(mockWebSocket, message);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"error":"获取配置失败"')
      );
    });

    it("应该正确处理状态处理器中的错误", async () => {
      const message = {
        type: WebSocketMessageType.CLIENT_STATUS,
        data: null, // 无效数据
      };

      await statusHandler.handle(mockWebSocket, message);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"error":"无效的状态数据"')
      );
    });

    it("应该正确处理服务处理器中的错误", async () => {
      // 设置错误的容器创建函数
      serviceHandler.setCreateContainer(async () => {
        throw new Error("服务获取失败");
      });

      const message = {
        type: WebSocketMessageType.RESTART_SERVICE,
      };

      await serviceHandler.handle(mockWebSocket, message);

      // 验证立即广播重启状态
      expect(mockBroadcastCallback).toHaveBeenCalledWith({
        type: WebSocketMessageType.RESTART_STATUS,
        data: {
          status: "restarting",
          error: undefined,
          timestamp: expect.any(Number),
        },
      });
    });
  });

  describe("初始数据发送测试", () => {
    it("应该正确发送初始配置和状态数据", async () => {
      const mockConfig: AppConfig = {
        mcpEndpoint: "http://localhost:3000",
        mcpServers: {},
        connection: {},
        modelscope: {},
        webUI: {},
        mcpServerConfig: {},
      };

      mockConfigManager.getConfig.mockReturnValue(mockConfig);

      // 发送初始数据
      await Promise.all([
        configHandler.sendInitialConfig(mockWebSocket),
        statusHandler.sendInitialStatus(mockWebSocket),
      ]);

      // 验证初始配置和状态都被发送
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "config",
          data: mockConfig,
        })
      );

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"status"')
      );
    });
  });

  describe("状态管理集成测试", () => {
    it("应该正确管理客户端连接状态", async () => {
      // 设置客户端为连接状态
      statusHandler.setClientConnected("http://localhost:6000", [
        "server1",
        "server2",
      ]);

      const clientInfo = statusHandler.getClientInfo();
      expect(clientInfo.status).toBe("connected");
      expect(clientInfo.mcpEndpoint).toBe("http://localhost:6000");
      expect(clientInfo.activeMCPServers).toEqual(["server1", "server2"]);

      // 通过消息更新状态
      const mockConfig: AppConfig = {
        mcpEndpoint: "http://localhost:3000",
        mcpServers: {},
        connection: {},
        modelscope: {},
        webUI: {},
        mcpServerConfig: {},
      };

      mockConfigManager.getConfig.mockReturnValue(mockConfig);

      const message = {
        type: WebSocketMessageType.CLIENT_STATUS,
        data: {
          status: "disconnected" as const,
        },
      };

      await statusHandler.handle(mockWebSocket, message);

      const updatedInfo = statusHandler.getClientInfo();
      expect(updatedInfo.status).toBe("disconnected");
      // 其他信息应该保持不变
      expect(updatedInfo.mcpEndpoint).toBe("http://localhost:6000");
      expect(updatedInfo.activeMCPServers).toEqual(["server1", "server2"]);
    });
  });
});
