import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../../configManager.js";
import { ConfigApiHandler } from "../ConfigApiHandler.js";

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

vi.mock("@services/ConfigService.js", () => ({
  ConfigService: vi.fn().mockImplementation(() => ({
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
    getMcpEndpoint: vi.fn(),
    getMcpEndpoints: vi.fn(),
    getMcpServers: vi.fn(),
    getConnectionConfig: vi.fn(),
    reloadConfig: vi.fn(),
    getConfigPath: vi.fn(),
    configExists: vi.fn(),
  })),
}));

describe("ConfigApiHandler", () => {
  let configApiHandler: ConfigApiHandler;
  let mockConfigService: any;
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
    vi.mocked(logger.withTag).mockReturnValue(mockLogger);

    // Mock ConfigService
    mockConfigService = {
      getConfig: vi.fn(),
      updateConfig: vi.fn(),
      getMcpEndpoint: vi.fn(),
      getMcpEndpoints: vi.fn(),
      getMcpServers: vi.fn(),
      getConnectionConfig: vi.fn(),
      reloadConfig: vi.fn(),
      getConfigPath: vi.fn(),
      configExists: vi.fn(),
    };
    const { ConfigService } = await import("@services/ConfigService.js");
    vi.mocked(ConfigService).mockImplementation(() => mockConfigService);

    // Mock Hono Context
    mockContext = {
      json: vi.fn().mockReturnValue(new Response()),
      req: {
        json: vi.fn(),
      },
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
      mockConfigService.getConfig.mockResolvedValue(mockConfig);

      await configApiHandler.getConfig(mockContext);

      expect(mockConfigService.getConfig).toHaveBeenCalledTimes(1);
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
      mockConfigService.getConfig.mockRejectedValue(error);

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
      mockConfigService.getConfig.mockRejectedValue("String error");

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
      mockConfigService.updateConfig.mockResolvedValue(undefined);

      await configApiHandler.updateConfig(mockContext);

      expect(mockContext.req.json).toHaveBeenCalledTimes(1);
      expect(mockConfigService.updateConfig).toHaveBeenCalledWith(
        mockConfig,
        "http-api"
      );
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

      await configApiHandler.updateConfig(mockContext);

      expect(mockConfigService.updateConfig).not.toHaveBeenCalled();
      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: {
            code: "INVALID_REQUEST_BODY",
            message: "请求体必须是有效的配置对象",
            details: undefined,
          },
        },
        400
      );
    });

    it("should handle invalid request body - string", async () => {
      mockContext.req.json.mockResolvedValue("invalid config");

      await configApiHandler.updateConfig(mockContext);

      expect(mockConfigService.updateConfig).not.toHaveBeenCalled();
      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: {
            code: "INVALID_REQUEST_BODY",
            message: "请求体必须是有效的配置对象",
            details: undefined,
          },
        },
        400
      );
    });

    it("should handle config service update error", async () => {
      const error = new Error("Config update failed");
      mockContext.req.json.mockResolvedValue(mockConfig);
      mockConfigService.updateConfig.mockRejectedValue(error);

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

    it("should handle non-Error exceptions during update", async () => {
      mockContext.req.json.mockResolvedValue(mockConfig);
      mockConfigService.updateConfig.mockRejectedValue("String error");

      await configApiHandler.updateConfig(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: {
            code: "CONFIG_UPDATE_ERROR",
            message: "配置更新失败",
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
      mockConfigService.getMcpEndpoint.mockReturnValue(endpoint);

      await configApiHandler.getMcpEndpoint(mockContext);

      expect(mockConfigService.getMcpEndpoint).toHaveBeenCalledTimes(1);
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
      mockConfigService.getMcpEndpoint.mockImplementation(() => {
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

    it("should handle non-Error exceptions", async () => {
      mockConfigService.getMcpEndpoint.mockImplementation(() => {
        throw "String error";
      });

      await configApiHandler.getMcpEndpoint(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: {
            code: "MCP_ENDPOINT_READ_ERROR",
            message: "获取 MCP 端点失败",
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
      mockConfigService.getMcpEndpoints.mockReturnValue(endpoints);

      await configApiHandler.getMcpEndpoints(mockContext);

      expect(mockConfigService.getMcpEndpoints).toHaveBeenCalledTimes(1);
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
      mockConfigService.getMcpEndpoints.mockImplementation(() => {
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

    it("should handle non-Error exceptions", async () => {
      mockConfigService.getMcpEndpoints.mockImplementation(() => {
        throw "String error";
      });

      await configApiHandler.getMcpEndpoints(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: {
            code: "MCP_ENDPOINTS_READ_ERROR",
            message: "获取 MCP 端点列表失败",
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
      mockConfigService.getMcpServers.mockReturnValue(servers);

      await configApiHandler.getMcpServers(mockContext);

      expect(mockConfigService.getMcpServers).toHaveBeenCalledTimes(1);
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
      mockConfigService.getMcpServers.mockImplementation(() => {
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

    it("should handle non-Error exceptions", async () => {
      mockConfigService.getMcpServers.mockImplementation(() => {
        throw "String error";
      });

      await configApiHandler.getMcpServers(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: {
            code: "MCP_SERVERS_READ_ERROR",
            message: "获取 MCP 服务配置失败",
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
      mockConfigService.getConnectionConfig.mockReturnValue(connection);

      await configApiHandler.getConnectionConfig(mockContext);

      expect(mockConfigService.getConnectionConfig).toHaveBeenCalledTimes(1);
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
      mockConfigService.getConnectionConfig.mockImplementation(() => {
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

    it("should handle non-Error exceptions", async () => {
      mockConfigService.getConnectionConfig.mockImplementation(() => {
        throw "String error";
      });

      await configApiHandler.getConnectionConfig(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: {
            code: "CONNECTION_CONFIG_READ_ERROR",
            message: "获取连接配置失败",
            details: undefined,
          },
        },
        500
      );
    });
  });

  describe("reloadConfig", () => {
    it("should reload configuration successfully", async () => {
      mockConfigService.reloadConfig.mockResolvedValue(mockConfig);

      await configApiHandler.reloadConfig(mockContext);

      expect(mockConfigService.reloadConfig).toHaveBeenCalledTimes(1);
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
      mockConfigService.reloadConfig.mockRejectedValue(error);

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

    it("should handle non-Error exceptions", async () => {
      mockConfigService.reloadConfig.mockRejectedValue("String error");

      await configApiHandler.reloadConfig(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: {
            code: "CONFIG_RELOAD_ERROR",
            message: "重新加载配置失败",
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
      mockConfigService.getConfigPath.mockReturnValue(path);

      await configApiHandler.getConfigPath(mockContext);

      expect(mockConfigService.getConfigPath).toHaveBeenCalledTimes(1);
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
      mockConfigService.getConfigPath.mockImplementation(() => {
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

    it("should handle non-Error exceptions", async () => {
      mockConfigService.getConfigPath.mockImplementation(() => {
        throw "String error";
      });

      await configApiHandler.getConfigPath(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: {
            code: "CONFIG_PATH_READ_ERROR",
            message: "获取配置文件路径失败",
            details: undefined,
          },
        },
        500
      );
    });
  });

  describe("checkConfigExists", () => {
    it("should return true when config exists", async () => {
      mockConfigService.configExists.mockReturnValue(true);

      await configApiHandler.checkConfigExists(mockContext);

      expect(mockConfigService.configExists).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith("处理检查配置是否存在请求");
      expect(mockLogger.debug).toHaveBeenCalledWith("配置存在检查结果: true");
      expect(mockContext.json).toHaveBeenCalledWith({
        success: true,
        data: { exists: true },
        message: undefined,
      });
    });

    it("should return false when config does not exist", async () => {
      mockConfigService.configExists.mockReturnValue(false);

      await configApiHandler.checkConfigExists(mockContext);

      expect(mockConfigService.configExists).toHaveBeenCalledTimes(1);
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
      mockConfigService.configExists.mockImplementation(() => {
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

    it("should handle non-Error exceptions", async () => {
      mockConfigService.configExists.mockImplementation(() => {
        throw "String error";
      });

      await configApiHandler.checkConfigExists(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: {
            code: "CONFIG_EXISTS_CHECK_ERROR",
            message: "检查配置是否存在失败",
            details: undefined,
          },
        },
        500
      );
    });
  });

  describe("helper methods", () => {
    it("should create error response correctly", () => {
      // Access private method through type assertion for testing
      const handler = configApiHandler as any;
      const errorResponse = handler.createErrorResponse(
        "TEST_ERROR",
        "Test error message",
        { detail: "test detail" }
      );

      expect(errorResponse).toEqual({
        error: {
          code: "TEST_ERROR",
          message: "Test error message",
          details: { detail: "test detail" },
        },
      });
    });

    it("should create error response without details", () => {
      const handler = configApiHandler as any;
      const errorResponse = handler.createErrorResponse(
        "TEST_ERROR",
        "Test error message"
      );

      expect(errorResponse).toEqual({
        error: {
          code: "TEST_ERROR",
          message: "Test error message",
          details: undefined,
        },
      });
    });

    it("should create success response with data and message", () => {
      const handler = configApiHandler as any;
      const successResponse = handler.createSuccessResponse(
        { test: "data" },
        "Success message"
      );

      expect(successResponse).toEqual({
        success: true,
        data: { test: "data" },
        message: "Success message",
      });
    });

    it("should create success response with only data", () => {
      const handler = configApiHandler as any;
      const successResponse = handler.createSuccessResponse({ test: "data" });

      expect(successResponse).toEqual({
        success: true,
        data: { test: "data" },
        message: undefined,
      });
    });

    it("should create success response with only message", () => {
      const handler = configApiHandler as any;
      const successResponse = handler.createSuccessResponse(
        undefined,
        "Success message"
      );

      expect(successResponse).toEqual({
        success: true,
        data: undefined,
        message: "Success message",
      });
    });

    it("should create success response with no parameters", () => {
      const handler = configApiHandler as any;
      const successResponse = handler.createSuccessResponse();

      expect(successResponse).toEqual({
        success: true,
        data: undefined,
        message: undefined,
      });
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete config workflow", async () => {
      // Get config
      mockConfigService.getConfig.mockResolvedValue(mockConfig);
      await configApiHandler.getConfig(mockContext);

      // Update config
      const updatedConfig = {
        ...mockConfig,
        mcpEndpoint: "ws://localhost:4000",
      };
      mockContext.req.json.mockResolvedValue(updatedConfig);
      mockConfigService.updateConfig.mockResolvedValue(undefined);
      await configApiHandler.updateConfig(mockContext);

      // Reload config
      mockConfigService.reloadConfig.mockResolvedValue(updatedConfig);
      await configApiHandler.reloadConfig(mockContext);

      expect(mockConfigService.getConfig).toHaveBeenCalledTimes(1);
      expect(mockConfigService.updateConfig).toHaveBeenCalledWith(
        updatedConfig,
        "http-api"
      );
      expect(mockConfigService.reloadConfig).toHaveBeenCalledTimes(1);
    });

    it("should handle multiple endpoint requests", async () => {
      const endpoint = "ws://localhost:3000";
      const endpoints = ["ws://localhost:3000", "ws://localhost:3001"];

      mockConfigService.getMcpEndpoint.mockReturnValue(endpoint);
      mockConfigService.getMcpEndpoints.mockReturnValue(endpoints);

      await configApiHandler.getMcpEndpoint(mockContext);
      await configApiHandler.getMcpEndpoints(mockContext);

      expect(mockConfigService.getMcpEndpoint).toHaveBeenCalledTimes(1);
      expect(mockConfigService.getMcpEndpoints).toHaveBeenCalledTimes(1);
    });

    it("should handle config existence check and path retrieval", async () => {
      const configPath = "/path/to/config.json";

      mockConfigService.configExists.mockReturnValue(true);
      mockConfigService.getConfigPath.mockReturnValue(configPath);

      await configApiHandler.checkConfigExists(mockContext);
      await configApiHandler.getConfigPath(mockContext);

      expect(mockConfigService.configExists).toHaveBeenCalledTimes(1);
      expect(mockConfigService.getConfigPath).toHaveBeenCalledTimes(1);
    });
  });
});
