import type { AppConfig } from "@/lib/config/manager.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigApiHandler } from "../ConfigApiHandler.js";

// 模拟依赖项
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/lib/config/manager.js", () => ({
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
    getMcpEndpoints: vi.fn(),
    getMcpServers: vi.fn(),
    getConnectionConfig: vi.fn(),
    reloadConfig: vi.fn(),
    getConfigPath: vi.fn(),
    configExists: vi.fn(),
    validateConfig: vi.fn(),
    updateConfig: vi.fn(),
  },
}));

describe("ConfigApiHandler", () => {
  let configApiHandler: ConfigApiHandler;
  let mockConfigManager: any;
  let mockLogger: any;
  let mockContext: any;

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
    Object.assign(logger, mockLogger);

    // Mock ConfigManager
    mockConfigManager = {
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
      getMcpEndpoints: vi.fn(),
      getMcpServers: vi.fn(),
      getConnectionConfig: vi.fn(),
      reloadConfig: vi.fn(),
      getConfigPath: vi.fn(),
      configExists: vi.fn(),
      validateConfig: vi.fn(),
      updateConfig: vi.fn(),
    };
    const { configManager } = await import("@/lib/config/manager.js");
    Object.assign(configManager, mockConfigManager);

    // 模拟 Hono 上下文
    mockContext = {
      json: vi.fn().mockReturnValue(new Response()),
      req: {
        json: vi.fn(),
      },
      get: vi.fn().mockImplementation((key: string) => {
        if (key === "logger") {
          return mockLogger;
        }
        return undefined;
      }),
    };

    configApiHandler = new ConfigApiHandler();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with correct dependencies", () => {
      expect(configApiHandler).toBeInstanceOf(ConfigApiHandler);
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });

  describe("getConfig", () => {
    it("should return config successfully", async () => {
      mockConfigManager.getConfig.mockReturnValue(mockConfig);

      await configApiHandler.getConfig(mockContext);

      expect(mockConfigManager.getConfig).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith("处理获取配置请求");
      expect(mockLogger.info).toHaveBeenCalledWith("获取配置成功");
      expect(mockContext.json).toHaveBeenCalledWith({
        success: true,
        data: mockConfig,
        message: undefined,
      });
    });

    it("should handle config service error", async () => {
      const error = new Error("Config read failed");
      mockConfigManager.getConfig.mockImplementation(() => {
        throw error;
      });

      await configApiHandler.getConfig(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith("获取配置失败:", error);
      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: {
            code: "CONFIG_READ_ERROR",
            message: "Config read failed",
            details: undefined,
          },
        },
        500
      );
    });

    it("should handle non-Error exceptions", async () => {
      mockConfigManager.getConfig.mockImplementation(() => {
        throw "String error";
      });

      await configApiHandler.getConfig(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: {
            code: "CONFIG_READ_ERROR",
            message: "获取配置失败",
            details: undefined,
          },
        },
        500
      );
    });
  });

  describe("updateConfig", () => {
    it("should update config successfully", async () => {
      mockContext.req.json.mockResolvedValue(mockConfig);

      await configApiHandler.updateConfig(mockContext);

      // 验证 validateConfig 被调用
      expect(mockConfigManager.validateConfig).toHaveBeenCalledWith(mockConfig);
      // 验证 updateConfig 被调用
      expect(mockConfigManager.updateConfig).toHaveBeenCalledWith(mockConfig);
      expect(mockContext.req.json).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith("处理更新配置请求");
      expect(mockLogger.info).toHaveBeenCalledWith("配置更新成功");
      expect(mockContext.json).toHaveBeenCalledWith({
        success: true,
        data: null,
        message: "配置更新成功",
      });
    });

    it("should handle invalid request body - null", async () => {
      mockContext.req.json.mockResolvedValue(null);
      mockConfigManager.validateConfig.mockImplementation(() => {
        throw new Error("配置必须是有效的对象");
      });

      await configApiHandler.updateConfig(mockContext);

      expect(mockConfigManager.updateConfig).not.toHaveBeenCalled();
      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: {
            code: "CONFIG_UPDATE_ERROR",
            message: "配置必须是有效的对象",
            details: undefined,
          },
        },
        400
      );
    });

    it("should handle invalid request body - string", async () => {
      mockContext.req.json.mockResolvedValue("invalid config");
      mockConfigManager.validateConfig.mockImplementation(() => {
        throw new Error("配置必须是有效的对象");
      });

      await configApiHandler.updateConfig(mockContext);

      expect(mockConfigManager.updateConfig).not.toHaveBeenCalled();
      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: {
            code: "CONFIG_UPDATE_ERROR",
            message: "配置必须是有效的对象",
            details: undefined,
          },
        },
        400
      );
    });

    it("should handle config update error", async () => {
      const error = new Error("Config update failed");
      mockContext.req.json.mockResolvedValue(mockConfig);
      mockConfigManager.validateConfig.mockImplementation(() => {
        throw error;
      });

      await configApiHandler.updateConfig(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith("配置更新失败:", error);
      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: {
            code: "CONFIG_UPDATE_ERROR",
            message: "Config update failed",
            details: undefined,
          },
        },
        400
      );
    });

    it("should handle JSON parsing error", async () => {
      const jsonError = new Error("Invalid JSON");
      mockContext.req.json.mockRejectedValue(jsonError);

      await configApiHandler.updateConfig(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith("配置更新失败:", jsonError);
      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: {
            code: "CONFIG_UPDATE_ERROR",
            message: "Invalid JSON",
            details: undefined,
          },
        },
        400
      );
    });
  });

  describe("getMcpEndpoint", () => {
    it("should return MCP endpoint successfully", async () => {
      const endpoint = "ws://localhost:3000";
      mockConfigManager.getMcpEndpoint.mockReturnValue(endpoint);

      await configApiHandler.getMcpEndpoint(mockContext);

      expect(mockConfigManager.getMcpEndpoint).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith("处理获取 MCP 端点请求");
      expect(mockLogger.debug).toHaveBeenCalledWith("获取 MCP 端点成功");
      expect(mockContext.json).toHaveBeenCalledWith({
        success: true,
        data: { endpoint },
        message: undefined,
      });
    });

    it("should handle MCP endpoint error", async () => {
      const error = new Error("MCP endpoint read failed");
      mockConfigManager.getMcpEndpoint.mockImplementation(() => {
        throw error;
      });

      await configApiHandler.getMcpEndpoint(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "获取 MCP 端点失败:",
        error
      );
      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: {
            code: "MCP_ENDPOINT_READ_ERROR",
            message: "MCP endpoint read failed",
            details: undefined,
          },
        },
        500
      );
    });
  });

  describe("getMcpEndpoints", () => {
    it("should return MCP endpoints list successfully", async () => {
      const endpoints = ["ws://localhost:3000", "ws://localhost:3001"];
      mockConfigManager.getMcpEndpoints.mockReturnValue(endpoints);

      await configApiHandler.getMcpEndpoints(mockContext);

      expect(mockConfigManager.getMcpEndpoints).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "处理获取 MCP 端点列表请求"
      );
      expect(mockLogger.debug).toHaveBeenCalledWith("获取 MCP 端点列表成功");
      expect(mockContext.json).toHaveBeenCalledWith({
        success: true,
        data: { endpoints },
        message: undefined,
      });
    });

    it("should handle MCP endpoints error", async () => {
      const error = new Error("MCP endpoints read failed");
      mockConfigManager.getMcpEndpoints.mockImplementation(() => {
        throw error;
      });

      await configApiHandler.getMcpEndpoints(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "获取 MCP 端点列表失败:",
        error
      );
      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: {
            code: "MCP_ENDPOINTS_READ_ERROR",
            message: "MCP endpoints read failed",
            details: undefined,
          },
        },
        500
      );
    });
  });

  describe("getMcpServers", () => {
    it("should return MCP servers configuration successfully", async () => {
      const servers = {
        calculator: { command: "node", args: ["calculator.js"] },
        datetime: { command: "python", args: ["datetime.py"] },
      };
      mockConfigManager.getMcpServers.mockReturnValue(servers);

      await configApiHandler.getMcpServers(mockContext);

      expect(mockConfigManager.getMcpServers).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "处理获取 MCP 服务配置请求"
      );
      expect(mockLogger.debug).toHaveBeenCalledWith("获取 MCP 服务配置成功");
      expect(mockContext.json).toHaveBeenCalledWith({
        success: true,
        data: { servers },
        message: undefined,
      });
    });

    it("should handle MCP servers error", async () => {
      const error = new Error("MCP servers read failed");
      mockConfigManager.getMcpServers.mockImplementation(() => {
        throw error;
      });

      await configApiHandler.getMcpServers(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "获取 MCP 服务配置失败:",
        error
      );
      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: {
            code: "MCP_SERVERS_READ_ERROR",
            message: "MCP servers read failed",
            details: undefined,
          },
        },
        500
      );
    });
  });

  describe("getConnectionConfig", () => {
    it("should return connection configuration successfully", async () => {
      const connection = {
        heartbeatInterval: 30000,
        heartbeatTimeout: 35000,
        reconnectInterval: 5000,
      };
      mockConfigManager.getConnectionConfig.mockReturnValue(connection);

      await configApiHandler.getConnectionConfig(mockContext);

      expect(mockConfigManager.getConnectionConfig).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith("处理获取连接配置请求");
      expect(mockLogger.debug).toHaveBeenCalledWith("获取连接配置成功");
      expect(mockContext.json).toHaveBeenCalledWith({
        success: true,
        data: { connection },
        message: undefined,
      });
    });

    it("should handle connection config error", async () => {
      const error = new Error("Connection config read failed");
      mockConfigManager.getConnectionConfig.mockImplementation(() => {
        throw error;
      });

      await configApiHandler.getConnectionConfig(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith("获取连接配置失败:", error);
      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: {
            code: "CONNECTION_CONFIG_READ_ERROR",
            message: "Connection config read failed",
            details: undefined,
          },
        },
        500
      );
    });
  });

  describe("reloadConfig", () => {
    it("should reload configuration successfully", async () => {
      mockConfigManager.getConfig.mockReturnValue(mockConfig);

      await configApiHandler.reloadConfig(mockContext);

      expect(mockConfigManager.reloadConfig).toHaveBeenCalledTimes(1);
      expect(mockConfigManager.getConfig).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith("处理重新加载配置请求");
      expect(mockLogger.info).toHaveBeenCalledWith("重新加载配置成功");
      expect(mockContext.json).toHaveBeenCalledWith({
        success: true,
        data: mockConfig,
        message: "配置重新加载成功",
      });
    });

    it("should handle reload config error", async () => {
      const error = new Error("Config reload failed");
      mockConfigManager.getConfig.mockImplementation(() => {
        throw error;
      });

      await configApiHandler.reloadConfig(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith("重新加载配置失败:", error);
      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: {
            code: "CONFIG_RELOAD_ERROR",
            message: "Config reload failed",
            details: undefined,
          },
        },
        500
      );
    });
  });

  describe("getConfigPath", () => {
    it("should return config file path successfully", async () => {
      const path = "/path/to/config.json";
      mockConfigManager.getConfigPath.mockReturnValue(path);

      await configApiHandler.getConfigPath(mockContext);

      expect(mockConfigManager.getConfigPath).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith("处理获取配置文件路径请求");
      expect(mockLogger.debug).toHaveBeenCalledWith("获取配置文件路径成功");
      expect(mockContext.json).toHaveBeenCalledWith({
        success: true,
        data: { path },
        message: undefined,
      });
    });

    it("should handle config path error", async () => {
      const error = new Error("Config path read failed");
      mockConfigManager.getConfigPath.mockImplementation(() => {
        throw error;
      });

      await configApiHandler.getConfigPath(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "获取配置文件路径失败:",
        error
      );
      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: {
            code: "CONFIG_PATH_READ_ERROR",
            message: "Config path read failed",
            details: undefined,
          },
        },
        500
      );
    });
  });

  describe("checkConfigExists", () => {
    it("should return true when config exists", async () => {
      mockConfigManager.configExists.mockReturnValue(true);

      await configApiHandler.checkConfigExists(mockContext);

      expect(mockConfigManager.configExists).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith("处理检查配置是否存在请求");
      expect(mockLogger.debug).toHaveBeenCalledWith("配置存在检查结果: true");
      expect(mockContext.json).toHaveBeenCalledWith({
        success: true,
        data: { exists: true },
        message: undefined,
      });
    });

    it("should return false when config does not exist", async () => {
      mockConfigManager.configExists.mockReturnValue(false);

      await configApiHandler.checkConfigExists(mockContext);

      expect(mockConfigManager.configExists).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith("处理检查配置是否存在请求");
      expect(mockLogger.debug).toHaveBeenCalledWith("配置存在检查结果: false");
      expect(mockContext.json).toHaveBeenCalledWith({
        success: true,
        data: { exists: false },
        message: undefined,
      });
    });

    it("should handle config exists check error", async () => {
      const error = new Error("Config exists check failed");
      mockConfigManager.configExists.mockImplementation(() => {
        throw error;
      });

      await configApiHandler.checkConfigExists(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "检查配置是否存在失败:",
        error
      );
      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: {
            code: "CONFIG_EXISTS_CHECK_ERROR",
            message: "Config exists check failed",
            details: undefined,
          },
        },
        500
      );
    });
  });
});
