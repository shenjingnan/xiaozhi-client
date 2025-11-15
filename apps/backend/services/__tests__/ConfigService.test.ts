import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../../configManager.js";
import { ConfigService } from "../ConfigService.js";

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

vi.mock("../../configManager.js", () => ({
  configManager: {
    getConfig: vi.fn(),
    getMcpEndpoint: vi.fn(),
    getMcpEndpoints: vi.fn(),
    getMcpServers: vi.fn(),
    getConnectionConfig: vi.fn(),
    getWebUIPort: vi.fn(),
    configExists: vi.fn(),
    reloadConfig: vi.fn(),
    getConfigPath: vi.fn(),
    updateMcpEndpoint: vi.fn(),
    updateMcpServer: vi.fn(),
    removeMcpServer: vi.fn(),
    removeServerToolsConfig: vi.fn(),
    updateConnectionConfig: vi.fn(),
    updateModelScopeConfig: vi.fn(),
    updateWebUIConfig: vi.fn(),
    setToolEnabled: vi.fn(),
  },
}));

vi.mock("../EventBus.js", () => ({
  getEventBus: vi.fn().mockReturnValue({
    emitEvent: vi.fn(),
    onEvent: vi.fn(),
  }),
}));

describe("ConfigService", () => {
  let configService: ConfigService;
  let mockLogger: any;
  let mockEventBus: any;
  let mockConfigManager: any;

  const mockConfig: AppConfig = {
    mcpEndpoint: "ws://localhost:3000",
    mcpServers: {
      calculator: {
        command: "node",
        args: ["calculator.js"],
      },
      datetime: {
        command: "python",
        args: ["datetime.py"],
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
    modelscope: {
      apiKey: "test-api-key",
    },
    mcpServerConfig: {
      calculator: {
        tools: {
          add: { enable: true },
          subtract: { enable: false },
        },
      },
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock Logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };
    const { logger } = await import("../../Logger.js");
    vi.mocked(logger.withTag).mockReturnValue(mockLogger);

    // Mock EventBus
    mockEventBus = {
      emitEvent: vi.fn(),
      onEvent: vi.fn(),
    };
    const { getEventBus } = await import("../EventBus.js");
    vi.mocked(getEventBus).mockReturnValue(mockEventBus);

    // Mock ConfigManager
    const { configManager } = await import("../../configManager.js");
    mockConfigManager = configManager;

    configService = new ConfigService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with correct dependencies", () => {
      expect(configService).toBeInstanceOf(ConfigService);
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });

  describe("getConfig", () => {
    it("should return config successfully", async () => {
      mockConfigManager.getConfig.mockReturnValue(mockConfig);

      const result = await configService.getConfig();

      expect(mockConfigManager.getConfig).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith("获取配置成功");
      expect(result).toEqual(mockConfig);
    });

    it("should handle config manager error", async () => {
      const error = new Error("Config read failed");
      mockConfigManager.getConfig.mockImplementation(() => {
        throw error;
      });

      await expect(configService.getConfig()).rejects.toThrow(
        "Config read failed"
      );

      expect(mockLogger.error).toHaveBeenCalledWith("获取配置失败:", error);
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith("config:error", {
        error: error,
        operation: "getConfig",
      });
    });

    it("should handle non-Error exceptions", async () => {
      mockConfigManager.getConfig.mockImplementation(() => {
        throw "String error";
      });

      await expect(configService.getConfig()).rejects.toThrow("String error");

      expect(mockEventBus.emitEvent).toHaveBeenCalledWith("config:error", {
        error: new Error("String error"),
        operation: "getConfig",
      });
    });
  });

  describe("updateConfig", () => {
    beforeEach(() => {
      // Setup default mocks for updateConfig dependencies
      mockConfigManager.getMcpEndpoint.mockReturnValue("ws://localhost:3000");
      mockConfigManager.getMcpServers.mockReturnValue({
        calculator: { command: "node", args: ["calculator.js"] },
      });
    });

    it("should update config successfully", async () => {
      await configService.updateConfig(mockConfig, "test-source");

      expect(mockLogger.info).toHaveBeenCalledWith(
        "开始更新配置，来源: test-source"
      );
      expect(mockLogger.info).toHaveBeenCalledWith("配置更新成功");
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith("config:updated", {
        type: "config",
        timestamp: expect.any(Date),
      });
    });

    it("should use default source when not provided", async () => {
      await configService.updateConfig(mockConfig);

      expect(mockLogger.info).toHaveBeenCalledWith(
        "开始更新配置，来源: unknown"
      );
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith("config:updated", {
        type: "config",
        timestamp: expect.any(Date),
      });
    });

    it("should validate config before updating", async () => {
      const invalidConfig = {} as AppConfig;

      await expect(configService.updateConfig(invalidConfig)).rejects.toThrow(
        "配置必须包含 mcpEndpoint"
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        "配置更新失败:",
        expect.any(Error)
      );
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith("config:error", {
        error: expect.any(Error),
        operation: "updateConfig",
      });
    });

    it("should update MCP endpoint when changed", async () => {
      const newConfig = {
        ...mockConfig,
        mcpEndpoint: "ws://localhost:4000",
      };
      mockConfigManager.getMcpEndpoint.mockReturnValue("ws://localhost:3000");

      await configService.updateConfig(newConfig);

      expect(mockConfigManager.updateMcpEndpoint).toHaveBeenCalledWith(
        "ws://localhost:4000"
      );
    });

    it("should not update MCP endpoint when unchanged", async () => {
      mockConfigManager.getMcpEndpoint.mockReturnValue("ws://localhost:3000");

      await configService.updateConfig(mockConfig);

      expect(mockConfigManager.updateMcpEndpoint).not.toHaveBeenCalled();
    });

    it("should update MCP servers when changed", async () => {
      const newConfig = {
        ...mockConfig,
        mcpServers: {
          calculator: { command: "node", args: ["calculator-new.js"] },
          weather: { command: "python", args: ["weather.py"] },
        },
      };

      await configService.updateConfig(newConfig);

      expect(mockConfigManager.updateMcpServer).toHaveBeenCalledWith(
        "calculator",
        { command: "node", args: ["calculator-new.js"] }
      );
      expect(mockConfigManager.updateMcpServer).toHaveBeenCalledWith(
        "weather",
        { command: "python", args: ["weather.py"] }
      );
    });

    it("should remove deleted MCP servers", async () => {
      const newConfig = {
        ...mockConfig,
        mcpServers: {
          datetime: { command: "python", args: ["datetime.py"] },
        },
      };
      mockConfigManager.getMcpServers.mockReturnValue({
        calculator: { command: "node", args: ["calculator.js"] },
        datetime: { command: "python", args: ["datetime.py"] },
      });

      await configService.updateConfig(newConfig);

      expect(mockConfigManager.removeMcpServer).toHaveBeenCalledWith(
        "calculator"
      );
      expect(mockConfigManager.removeServerToolsConfig).toHaveBeenCalledWith(
        "calculator"
      );
    });

    it("should update connection config when provided", async () => {
      await configService.updateConfig(mockConfig);

      expect(mockConfigManager.updateConnectionConfig).toHaveBeenCalledWith(
        mockConfig.connection
      );
    });

    it("should update ModelScope config when provided", async () => {
      await configService.updateConfig(mockConfig);

      expect(mockConfigManager.updateModelScopeConfig).toHaveBeenCalledWith(
        mockConfig.modelscope
      );
    });

    it("should update Web UI config when provided", async () => {
      await configService.updateConfig(mockConfig);

      expect(mockConfigManager.updateWebUIConfig).toHaveBeenCalledWith(
        mockConfig.webUI
      );
    });

    it("should update server tools config when provided", async () => {
      await configService.updateConfig(mockConfig);

      expect(mockConfigManager.setToolEnabled).toHaveBeenCalledWith(
        "calculator",
        "add",
        true
      );
      expect(mockConfigManager.setToolEnabled).toHaveBeenCalledWith(
        "calculator",
        "subtract",
        false
      );
    });

    it("should handle update errors", async () => {
      const error = new Error("Update failed");
      mockConfigManager.updateMcpEndpoint.mockImplementation(() => {
        throw error;
      });

      const newConfig = {
        ...mockConfig,
        mcpEndpoint: "ws://localhost:4000",
      };
      mockConfigManager.getMcpEndpoint.mockReturnValue("ws://localhost:3000");

      await expect(configService.updateConfig(newConfig)).rejects.toThrow(
        "Update failed"
      );

      expect(mockLogger.error).toHaveBeenCalledWith("配置更新失败:", error);
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith("config:error", {
        error: error,
        operation: "updateConfig",
      });
    });

    it("should handle non-Error exceptions during update", async () => {
      mockConfigManager.updateMcpEndpoint.mockImplementation(() => {
        throw "String error";
      });

      const newConfig = {
        ...mockConfig,
        mcpEndpoint: "ws://localhost:4000",
      };
      mockConfigManager.getMcpEndpoint.mockReturnValue("ws://localhost:3000");

      await expect(configService.updateConfig(newConfig)).rejects.toThrow(
        "String error"
      );

      expect(mockEventBus.emitEvent).toHaveBeenCalledWith("config:error", {
        error: new Error("String error"),
        operation: "updateConfig",
      });
    });
  });

  describe("getMcpEndpoint", () => {
    it("should return MCP endpoint successfully", () => {
      const endpoint = "ws://localhost:3000";
      mockConfigManager.getMcpEndpoint.mockReturnValue(endpoint);

      const result = configService.getMcpEndpoint();

      expect(mockConfigManager.getMcpEndpoint).toHaveBeenCalledTimes(1);
      expect(result).toBe(endpoint);
    });

    it("should handle getMcpEndpoint error", () => {
      const error = new Error("Get endpoint failed");
      mockConfigManager.getMcpEndpoint.mockImplementation(() => {
        throw error;
      });

      expect(() => configService.getMcpEndpoint()).toThrow(
        "Get endpoint failed"
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        "获取 MCP 端点失败:",
        error
      );
    });
  });

  describe("getMcpEndpoints", () => {
    it("should return MCP endpoints list successfully", () => {
      const endpoints = ["ws://localhost:3000", "ws://localhost:3001"];
      mockConfigManager.getMcpEndpoints.mockReturnValue(endpoints);

      const result = configService.getMcpEndpoints();

      expect(mockConfigManager.getMcpEndpoints).toHaveBeenCalledTimes(1);
      expect(result).toEqual(endpoints);
    });

    it("should handle getMcpEndpoints error", () => {
      const error = new Error("Get endpoints failed");
      mockConfigManager.getMcpEndpoints.mockImplementation(() => {
        throw error;
      });

      expect(() => configService.getMcpEndpoints()).toThrow(
        "Get endpoints failed"
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        "获取 MCP 端点列表失败:",
        error
      );
    });
  });

  describe("getMcpServers", () => {
    it("should return MCP servers configuration successfully", () => {
      const servers = {
        calculator: { command: "node", args: ["calculator.js"] },
        datetime: { command: "python", args: ["datetime.py"] },
      };
      mockConfigManager.getMcpServers.mockReturnValue(servers);

      const result = configService.getMcpServers();

      expect(mockConfigManager.getMcpServers).toHaveBeenCalledTimes(1);
      expect(result).toEqual(servers);
    });

    it("should handle getMcpServers error", () => {
      const error = new Error("Get servers failed");
      mockConfigManager.getMcpServers.mockImplementation(() => {
        throw error;
      });

      expect(() => configService.getMcpServers()).toThrow("Get servers failed");

      expect(mockLogger.error).toHaveBeenCalledWith(
        "获取 MCP 服务配置失败:",
        error
      );
    });
  });

  describe("getConnectionConfig", () => {
    it("should return connection configuration successfully", () => {
      const connection = {
        heartbeatInterval: 30000,
        heartbeatTimeout: 35000,
        reconnectInterval: 5000,
      };
      mockConfigManager.getConnectionConfig.mockReturnValue(connection);

      const result = configService.getConnectionConfig();

      expect(mockConfigManager.getConnectionConfig).toHaveBeenCalledTimes(1);
      expect(result).toEqual(connection);
    });

    it("should handle getConnectionConfig error", () => {
      const error = new Error("Get connection config failed");
      mockConfigManager.getConnectionConfig.mockImplementation(() => {
        throw error;
      });

      expect(() => configService.getConnectionConfig()).toThrow(
        "Get connection config failed"
      );

      expect(mockLogger.error).toHaveBeenCalledWith("获取连接配置失败:", error);
    });
  });

  describe("getWebUIPort", () => {
    it("should return Web UI port successfully", () => {
      const port = 3001;
      mockConfigManager.getWebUIPort.mockReturnValue(port);

      const result = configService.getWebUIPort();

      expect(mockConfigManager.getWebUIPort).toHaveBeenCalledTimes(1);
      expect(result).toBe(port);
    });

    it("should return default port when getWebUIPort returns null", () => {
      mockConfigManager.getWebUIPort.mockReturnValue(null);

      const result = configService.getWebUIPort();

      expect(result).toBe(9999);
    });

    it("should return default port when getWebUIPort returns undefined", () => {
      mockConfigManager.getWebUIPort.mockReturnValue(undefined);

      const result = configService.getWebUIPort();

      expect(result).toBe(9999);
    });

    it("should handle getWebUIPort error and return default", () => {
      const error = new Error("Get port failed");
      mockConfigManager.getWebUIPort.mockImplementation(() => {
        throw error;
      });

      const result = configService.getWebUIPort();

      expect(mockLogger.error).toHaveBeenCalledWith(
        "获取 Web UI 端口失败:",
        error
      );
      expect(result).toBe(9999);
    });
  });

  describe("validateConfig", () => {
    it("should validate valid config successfully", async () => {
      // This test indirectly tests validateConfig through updateConfig
      // Setup mocks for updateConfig
      mockConfigManager.getMcpEndpoint.mockReturnValue("ws://localhost:3000");
      mockConfigManager.getMcpServers.mockReturnValue({});

      await configService.updateConfig(mockConfig);

      expect(mockLogger.info).toHaveBeenCalledWith("配置更新成功");
    });

    it("should reject null config", async () => {
      await expect(configService.updateConfig(null as any)).rejects.toThrow(
        "配置必须是有效的对象"
      );
    });

    it("should reject undefined config", async () => {
      await expect(
        configService.updateConfig(undefined as any)
      ).rejects.toThrow("配置必须是有效的对象");
    });

    it("should reject non-object config", async () => {
      await expect(
        configService.updateConfig("invalid" as any)
      ).rejects.toThrow("配置必须是有效的对象");
    });

    it("should reject config without mcpEndpoint", async () => {
      const invalidConfig = {
        mcpServers: {},
      } as AppConfig;

      await expect(configService.updateConfig(invalidConfig)).rejects.toThrow(
        "配置必须包含 mcpEndpoint"
      );
    });

    it("should reject config without mcpServers", async () => {
      const invalidConfig = {
        mcpEndpoint: "ws://localhost:3000",
      } as AppConfig;

      await expect(configService.updateConfig(invalidConfig)).rejects.toThrow(
        "配置必须包含有效的 mcpServers"
      );
    });

    it("should reject config with invalid mcpServers", async () => {
      const invalidConfig = {
        mcpEndpoint: "ws://localhost:3000",
        mcpServers: "invalid",
      } as any;

      await expect(configService.updateConfig(invalidConfig)).rejects.toThrow(
        "配置必须包含有效的 mcpServers"
      );
    });
  });

  describe("configExists", () => {
    it("should return true when config exists", () => {
      mockConfigManager.configExists.mockReturnValue(true);

      const result = configService.configExists();

      expect(mockConfigManager.configExists).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });

    it("should return false when config does not exist", () => {
      mockConfigManager.configExists.mockReturnValue(false);

      const result = configService.configExists();

      expect(mockConfigManager.configExists).toHaveBeenCalledTimes(1);
      expect(result).toBe(false);
    });
  });

  describe("reloadConfig", () => {
    it("should reload config successfully", async () => {
      mockConfigManager.getConfig.mockReturnValue(mockConfig);

      const result = await configService.reloadConfig();

      expect(mockLogger.info).toHaveBeenCalledWith("重新加载配置");
      expect(mockConfigManager.reloadConfig).toHaveBeenCalledTimes(1);
      expect(mockConfigManager.getConfig).toHaveBeenCalledTimes(1);
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith("config:updated", {
        type: "config",
        timestamp: expect.any(Date),
      });
      expect(result).toEqual(mockConfig);
    });

    it("should handle reload config error", async () => {
      const error = new Error("Reload failed");
      mockConfigManager.reloadConfig.mockImplementation(() => {
        throw error;
      });

      await expect(configService.reloadConfig()).rejects.toThrow(
        "Reload failed"
      );

      expect(mockLogger.error).toHaveBeenCalledWith("重新加载配置失败:", error);
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith("config:error", {
        error: error,
        operation: "reloadConfig",
      });
    });

    it("should handle getConfig error after reload", async () => {
      const error = new Error("Get config after reload failed");
      // First call to reloadConfig succeeds, second call to getConfig fails
      mockConfigManager.reloadConfig.mockImplementation(() => {});
      mockConfigManager.getConfig.mockImplementation(() => {
        throw error;
      });

      await expect(configService.reloadConfig()).rejects.toThrow(
        "Get config after reload failed"
      );

      expect(mockEventBus.emitEvent).toHaveBeenCalledWith("config:error", {
        error: error,
        operation: "reloadConfig",
      });
    });

    it("should handle non-Error exceptions during reload", async () => {
      mockConfigManager.reloadConfig.mockImplementation(() => {
        throw "String error";
      });

      await expect(configService.reloadConfig()).rejects.toThrow(
        "String error"
      );

      expect(mockEventBus.emitEvent).toHaveBeenCalledWith("config:error", {
        error: new Error("String error"),
        operation: "reloadConfig",
      });
    });
  });

  describe("getConfigPath", () => {
    it("should return config file path successfully", () => {
      const path = "/path/to/config.json";
      mockConfigManager.getConfigPath.mockReturnValue(path);

      const result = configService.getConfigPath();

      expect(mockConfigManager.getConfigPath).toHaveBeenCalledTimes(1);
      expect(result).toBe(path);
    });
  });

  describe("integration scenarios", () => {
    beforeEach(() => {
      // Setup default mocks for integration tests
      mockConfigManager.getMcpEndpoint.mockReturnValue("ws://localhost:3000");
      mockConfigManager.getMcpServers.mockReturnValue({});
      mockConfigManager.getConfig.mockReturnValue(mockConfig);
      mockConfigManager.reloadConfig.mockImplementation(() => {});
      mockConfigManager.updateMcpEndpoint.mockImplementation(() => {});
      mockConfigManager.updateMcpServer.mockImplementation(() => {});
      mockConfigManager.removeMcpServer.mockImplementation(() => {});
      mockConfigManager.removeServerToolsConfig.mockImplementation(() => {});
      mockConfigManager.updateConnectionConfig.mockImplementation(() => {});
      mockConfigManager.updateModelScopeConfig.mockImplementation(() => {});
      mockConfigManager.updateWebUIConfig.mockImplementation(() => {});
      mockConfigManager.setToolEnabled.mockImplementation(() => {});
    });

    it("should handle complete config workflow", async () => {
      // Get config
      const config = await configService.getConfig();
      expect(config).toEqual(mockConfig);

      // Update config
      const updatedConfig = {
        ...mockConfig,
        mcpEndpoint: "ws://localhost:4000",
      };
      mockConfigManager.getMcpEndpoint.mockReturnValue("ws://localhost:3000");
      await configService.updateConfig(updatedConfig, "integration-test");

      // Reload config - reset mocks for reload
      mockConfigManager.reloadConfig.mockImplementation(() => {});
      mockConfigManager.getConfig.mockReturnValue(updatedConfig);
      const reloadedConfig = await configService.reloadConfig();
      expect(reloadedConfig).toEqual(updatedConfig);

      // Verify all operations were called
      expect(mockConfigManager.getConfig).toHaveBeenCalledTimes(2);
      expect(mockConfigManager.updateMcpEndpoint).toHaveBeenCalledWith(
        "ws://localhost:4000"
      );
      expect(mockConfigManager.reloadConfig).toHaveBeenCalledTimes(1);
    });

    it("should handle mixed success and error scenarios", async () => {
      // First operation succeeds
      const config = await configService.getConfig();
      expect(config).toEqual(mockConfig);

      // Second operation fails
      const error = new Error("Update failed");
      mockConfigManager.updateMcpEndpoint.mockImplementation(() => {
        throw error;
      });

      const updatedConfig = {
        ...mockConfig,
        mcpEndpoint: "ws://localhost:4000",
      };
      mockConfigManager.getMcpEndpoint.mockReturnValue("ws://localhost:3000");

      await expect(configService.updateConfig(updatedConfig)).rejects.toThrow(
        "Update failed"
      );

      // Third operation succeeds - reset mocks
      mockConfigManager.updateMcpEndpoint.mockImplementation(() => {});
      mockConfigManager.reloadConfig.mockImplementation(() => {});
      mockConfigManager.getConfig.mockReturnValue(mockConfig);
      const reloadedConfig = await configService.reloadConfig();
      expect(reloadedConfig).toEqual(mockConfig);
    });

    it("should handle config service methods in sequence", () => {
      // Test all getter methods
      mockConfigManager.getMcpEndpoint.mockReturnValue("ws://localhost:3000");
      mockConfigManager.getMcpEndpoints.mockReturnValue([
        "ws://localhost:3000",
        "ws://localhost:3001",
      ]);
      mockConfigManager.getMcpServers.mockReturnValue({
        calculator: { command: "node", args: ["calculator.js"] },
      });
      mockConfigManager.getConnectionConfig.mockReturnValue({
        heartbeatInterval: 30000,
        heartbeatTimeout: 35000,
        reconnectInterval: 5000,
      });
      mockConfigManager.getWebUIPort.mockReturnValue(3001);
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getConfigPath.mockReturnValue("/path/to/config.json");

      expect(configService.getMcpEndpoint()).toBe("ws://localhost:3000");
      expect(configService.getMcpEndpoints()).toEqual([
        "ws://localhost:3000",
        "ws://localhost:3001",
      ]);
      expect(configService.getMcpServers()).toEqual({
        calculator: { command: "node", args: ["calculator.js"] },
      });
      expect(configService.getConnectionConfig()).toEqual({
        heartbeatInterval: 30000,
        heartbeatTimeout: 35000,
        reconnectInterval: 5000,
      });
      expect(configService.getWebUIPort()).toBe(3001);
      expect(configService.configExists()).toBe(true);
      expect(configService.getConfigPath()).toBe("/path/to/config.json");
    });
  });

  describe("edge cases and boundary conditions", () => {
    beforeEach(() => {
      mockConfigManager.getMcpEndpoint.mockReturnValue("ws://localhost:3000");
      mockConfigManager.getMcpServers.mockReturnValue({});
    });

    it("should handle config with minimal required fields", async () => {
      const minimalConfig: AppConfig = {
        mcpEndpoint: "ws://localhost:3000",
        mcpServers: {},
      };

      await configService.updateConfig(minimalConfig);

      expect(mockLogger.info).toHaveBeenCalledWith("配置更新成功");
    });

    it("should handle config with all optional fields", async () => {
      const fullConfig: AppConfig = {
        mcpEndpoint: ["ws://localhost:3000", "ws://localhost:3001"],
        mcpServers: {
          calculator: { command: "node", args: ["calculator.js"] },
          datetime: { command: "python", args: ["datetime.py"] },
        },
        connection: {
          heartbeatInterval: 30000,
          heartbeatTimeout: 35000,
          reconnectInterval: 5000,
        },
        webUI: {
          port: 3001,
          autoRestart: true,
        },
        modelscope: {
          apiKey: "test-api-key",
        },
        mcpServerConfig: {
          calculator: {
            tools: {
              add: { enable: true, description: "Addition tool" },
              subtract: { enable: false, usageCount: 5 },
            },
          },
        },
      };

      // Reset mocks for this test
      mockConfigManager.getMcpEndpoint.mockReturnValue("ws://localhost:3000");
      mockConfigManager.getMcpServers.mockReturnValue({});

      await configService.updateConfig(fullConfig);

      expect(mockConfigManager.updateConnectionConfig).toHaveBeenCalledWith(
        fullConfig.connection
      );
      expect(mockConfigManager.updateWebUIConfig).toHaveBeenCalledWith(
        fullConfig.webUI
      );
      expect(mockConfigManager.updateModelScopeConfig).toHaveBeenCalledWith(
        fullConfig.modelscope
      );
    });

    it("should handle empty mcpServers object", async () => {
      const configWithEmptyServers: AppConfig = {
        mcpEndpoint: "ws://localhost:3000",
        mcpServers: {},
      };

      await configService.updateConfig(configWithEmptyServers);

      expect(mockLogger.info).toHaveBeenCalledWith("配置更新成功");
    });

    it("should handle large number of MCP servers", async () => {
      const largeServersConfig: AppConfig = {
        mcpEndpoint: "ws://localhost:3000",
        mcpServers: {},
      };

      // Generate 100 servers
      for (let i = 0; i < 100; i++) {
        largeServersConfig.mcpServers[`server-${i}`] = {
          command: "node",
          args: [`server-${i}.js`],
        };
      }

      await configService.updateConfig(largeServersConfig);

      expect(mockConfigManager.updateMcpServer).toHaveBeenCalledTimes(100);
    });

    it("should handle config with special characters in server names", async () => {
      const specialConfig: AppConfig = {
        mcpEndpoint: "ws://localhost:3000",
        mcpServers: {
          "server-with-dashes": { command: "node", args: ["server.js"] },
          server_with_underscores: { command: "python", args: ["server.py"] },
          "server.with.dots": { command: "java", args: ["Server.jar"] },
          服务器中文名: { command: "node", args: ["chinese-server.js"] },
        },
      };

      await configService.updateConfig(specialConfig);

      expect(mockConfigManager.updateMcpServer).toHaveBeenCalledWith(
        "server-with-dashes",
        { command: "node", args: ["server.js"] }
      );
      expect(mockConfigManager.updateMcpServer).toHaveBeenCalledWith(
        "server_with_underscores",
        { command: "python", args: ["server.py"] }
      );
      expect(mockConfigManager.updateMcpServer).toHaveBeenCalledWith(
        "server.with.dots",
        { command: "java", args: ["Server.jar"] }
      );
      expect(mockConfigManager.updateMcpServer).toHaveBeenCalledWith(
        "服务器中文名",
        { command: "node", args: ["chinese-server.js"] }
      );
    });

    it("should handle config with very long values", async () => {
      const longEndpoint = `ws://localhost:3000/${"a".repeat(1000)}`;
      const longConfig: AppConfig = {
        mcpEndpoint: longEndpoint,
        mcpServers: {
          "long-server": {
            command: "node",
            args: [`${"very-long-argument-".repeat(100)}.js`],
          },
        },
      };

      // Reset mocks for this test
      mockConfigManager.getMcpEndpoint.mockReturnValue("ws://localhost:3000");
      mockConfigManager.getMcpServers.mockReturnValue({});

      await configService.updateConfig(longConfig);

      expect(mockConfigManager.updateMcpEndpoint).toHaveBeenCalledWith(
        longEndpoint
      );
    });

    it("should handle concurrent config operations", async () => {
      const promises = [];

      // Simulate concurrent operations
      for (let i = 0; i < 10; i++) {
        promises.push(configService.getConfig());
        promises.push(configService.getMcpEndpoint());
        promises.push(configService.getMcpServers());
      }

      await Promise.all(promises);

      expect(mockConfigManager.getConfig).toHaveBeenCalledTimes(10);
      expect(mockConfigManager.getMcpEndpoint).toHaveBeenCalledTimes(10);
      expect(mockConfigManager.getMcpServers).toHaveBeenCalledTimes(10);
    });

    it("should handle null and undefined optional fields gracefully", async () => {
      const configWithNulls: AppConfig = {
        mcpEndpoint: "ws://localhost:3000",
        mcpServers: {},
        connection: undefined,
        webUI: null as any,
        modelscope: undefined,
        mcpServerConfig: null as any,
      };

      await configService.updateConfig(configWithNulls);

      // Should not call update methods for null/undefined fields
      expect(mockConfigManager.updateConnectionConfig).not.toHaveBeenCalled();
      expect(mockConfigManager.updateWebUIConfig).not.toHaveBeenCalled();
      expect(mockConfigManager.updateModelScopeConfig).not.toHaveBeenCalled();
      expect(mockConfigManager.setToolEnabled).not.toHaveBeenCalled();
    });
  });
});
