/**
 * ConfigHandler 测试
 * 测试配置消息处理器的功能
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../../configManager.js";
import { WebSocketMessageType } from "../types.js";
import { ConfigHandler } from "./ConfigHandler.js";

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

describe("ConfigHandler", () => {
  let configHandler: ConfigHandler;
  let mockWebSocket: any;
  let mockBroadcastCallback: ReturnType<typeof vi.fn>;
  let mockConfigManager: any;

  beforeEach(async () => {
    configHandler = new ConfigHandler();
    mockBroadcastCallback = vi.fn();

    // 获取 mock configManager 引用
    const configManagerModule = await import("../../configManager.js");
    mockConfigManager = configManagerModule.configManager;

    // 设置广播回调
    configHandler.setBroadcastCallback(mockBroadcastCallback);

    // Mock WebSocket
    mockWebSocket = {
      send: vi.fn(),
      readyState: 1, // WebSocket.OPEN
    };

    // 重置所有 mock
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("canHandle", () => {
    it("应该能够处理 getConfig 消息", () => {
      expect(configHandler.canHandle(WebSocketMessageType.GET_CONFIG)).toBe(
        true
      );
    });

    it("应该能够处理 updateConfig 消息", () => {
      expect(configHandler.canHandle(WebSocketMessageType.UPDATE_CONFIG)).toBe(
        true
      );
    });

    it("应该不能处理其他类型的消息", () => {
      expect(configHandler.canHandle(WebSocketMessageType.GET_STATUS)).toBe(
        false
      );
      expect(
        configHandler.canHandle(WebSocketMessageType.RESTART_SERVICE)
      ).toBe(false);
      expect(configHandler.canHandle("unknown")).toBe(false);
    });
  });

  describe("handle", () => {
    it("应该处理 getConfig 消息", async () => {
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
        type: WebSocketMessageType.GET_CONFIG,
      };

      await configHandler.handle(mockWebSocket, message);

      expect(mockConfigManager.getConfig).toHaveBeenCalledTimes(1);
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "config",
          data: mockConfig,
        })
      );
    });

    it("应该处理 updateConfig 消息", async () => {
      const newConfig: AppConfig = {
        mcpEndpoint: "http://localhost:4000",
        mcpServers: {
          "test-server": {
            command: "test-command",
            args: ["--test"],
          },
        },
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

      expect(mockConfigManager.updateMcpEndpoint).toHaveBeenCalledWith(
        "http://localhost:4000"
      );
      expect(mockBroadcastCallback).toHaveBeenCalledWith({
        type: WebSocketMessageType.CONFIG_UPDATE,
        data: newConfig,
      });
    });

    it("应该处理无效的配置数据", async () => {
      const message = {
        type: WebSocketMessageType.UPDATE_CONFIG,
        config: null,
      };

      await configHandler.handle(mockWebSocket, message);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"error":"无效的配置数据"')
      );
    });

    it("应该处理未知消息类型", async () => {
      const message = {
        type: "unknown",
      };

      await configHandler.handle(mockWebSocket, message);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"error":"未知消息类型: unknown"')
      );
    });

    it("应该处理配置获取时的错误", async () => {
      mockConfigManager.getConfig.mockImplementation(() => {
        throw new Error("配置获取失败");
      });

      const message = {
        type: WebSocketMessageType.GET_CONFIG,
      };

      await configHandler.handle(mockWebSocket, message);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"error":"获取配置失败"')
      );
    });

    it("应该处理配置更新时的错误", async () => {
      const newConfig: AppConfig = {
        mcpEndpoint: "http://localhost:4000",
        mcpServers: {},
        connection: {},
        modelscope: {},
        webUI: {},
        mcpServerConfig: {},
      };

      mockConfigManager.getMcpEndpoint.mockImplementation(() => {
        throw new Error("配置更新失败");
      });

      const message = {
        type: WebSocketMessageType.UPDATE_CONFIG,
        config: newConfig,
      };

      await configHandler.handle(mockWebSocket, message);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"error":"更新配置失败"')
      );
    });
  });

  describe("配置更新逻辑", () => {
    it("应该更新 MCP 端点", async () => {
      const newConfig: AppConfig = {
        mcpEndpoint: "http://localhost:5000",
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

      expect(mockConfigManager.updateMcpEndpoint).toHaveBeenCalledWith(
        "http://localhost:5000"
      );
    });

    it("应该添加新的 MCP 服务", async () => {
      const newConfig: AppConfig = {
        mcpEndpoint: "http://localhost:3000",
        mcpServers: {
          "new-server": {
            command: "new-command",
            args: ["--arg1"],
          },
        },
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

      expect(mockConfigManager.updateMcpServer).toHaveBeenCalledWith(
        "new-server",
        {
          command: "new-command",
          args: ["--arg1"],
        }
      );
    });

    it("应该删除不存在的 MCP 服务", async () => {
      const newConfig: AppConfig = {
        mcpEndpoint: "http://localhost:3000",
        mcpServers: {},
        connection: {},
        modelscope: {},
        webUI: {},
        mcpServerConfig: {},
      };

      mockConfigManager.getMcpEndpoint.mockReturnValue("http://localhost:3000");
      mockConfigManager.getMcpServers.mockReturnValue({
        "old-server": {
          command: "old-command",
          args: [],
        },
      });

      const message = {
        type: WebSocketMessageType.UPDATE_CONFIG,
        config: newConfig,
      };

      await configHandler.handle(mockWebSocket, message);

      expect(mockConfigManager.removeMcpServer).toHaveBeenCalledWith(
        "old-server"
      );
      expect(mockConfigManager.removeServerToolsConfig).toHaveBeenCalledWith(
        "old-server"
      );
    });
  });

  describe("sendInitialConfig", () => {
    it("应该发送初始配置数据", async () => {
      const mockConfig: AppConfig = {
        mcpEndpoint: "http://localhost:3000",
        mcpServers: {},
        connection: {},
        modelscope: {},
        webUI: {},
        mcpServerConfig: {},
      };

      mockConfigManager.getConfig.mockReturnValue(mockConfig);

      await configHandler.sendInitialConfig(mockWebSocket);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "config",
          data: mockConfig,
        })
      );
    });

    it("应该处理发送初始配置时的错误", async () => {
      mockConfigManager.getConfig.mockImplementation(() => {
        throw new Error("获取配置失败");
      });

      await configHandler.sendInitialConfig(mockWebSocket);

      // 应该不会抛出错误，只是记录日志
      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });
  });

  describe("setBroadcastCallback", () => {
    it("应该正确设置广播回调", async () => {
      const newCallback = vi.fn();
      configHandler.setBroadcastCallback(newCallback);

      const newConfig: AppConfig = {
        mcpEndpoint: "http://localhost:3000",
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

      expect(newCallback).toHaveBeenCalledWith({
        type: WebSocketMessageType.CONFIG_UPDATE,
        data: newConfig,
      });
    });
  });
});
