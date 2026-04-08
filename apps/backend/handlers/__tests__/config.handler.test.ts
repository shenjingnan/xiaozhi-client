import type { AppConfig } from "@xiaozhi-client/config";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigApiHandler } from "../config.handler.js";

// 模拟依赖项
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// 模拟 prompt-utils
vi.mock("@/utils/prompt-utils.js", () => ({
  listPromptFiles: vi.fn(),
  readPromptFile: vi.fn(),
  updatePromptFile: vi.fn(),
  createPromptFile: vi.fn(),
  deletePromptFile: vi.fn(),
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
    getMcpEndpoints: vi.fn(),
    getMcpServers: vi.fn(),
    getConnectionConfig: vi.fn(),
    reloadConfig: vi.fn(),
    getConfigPath: vi.fn(),
    configExists: vi.fn(),
    validateConfig: vi.fn(),
    updateConfig: vi.fn(),
    getToolCallLogConfig: vi.fn().mockReturnValue({
      maxRecords: 100,
      logFilePath: undefined,
    }),
    getConfigDir: vi.fn().mockReturnValue(process.cwd()),
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
      getToolCallLogConfig: vi.fn().mockReturnValue({
        maxRecords: 100,
        logFilePath: undefined,
      }),
      getConfigDir: vi.fn().mockReturnValue(process.cwd()),
    };
    const { configManager } = await import("@xiaozhi-client/config");
    Object.assign(configManager, mockConfigManager);

    // 模拟 Hono 上下文
    mockContext = {
      // 添加 c.get 方法支持依赖注入
      get: vi.fn((key: string) => {
        if (key === "logger") return mockLogger;
        return undefined;
      }),
      // 添加 c.success 方法
      success: vi
        .fn()
        .mockImplementation((data: unknown, message?: string, status = 200) => {
          const response: {
            success: true;
            data?: unknown;
            message?: string;
          } = {
            success: true,
            message,
          };
          if (data !== undefined) {
            response.data = data;
          }
          return new Response(JSON.stringify(response), {
            status,
            headers: { "Content-Type": "application/json" },
          });
        }),
      // 添加 c.fail 方法
      fail: vi
        .fn()
        .mockImplementation(
          (code: string, message: string, details?: any, status = 400) => {
            return new Response(
              JSON.stringify({
                success: false,
                error: {
                  code,
                  message,
                  ...(details !== undefined && { details }),
                },
              }),
              {
                status,
                headers: { "Content-Type": "application/json" },
              }
            );
          }
        ),
      json: vi.fn().mockReturnValue(new Response()),
      req: {
        json: vi.fn(),
      },
      logger: mockLogger, // 向后兼容
    };

    configApiHandler = new ConfigApiHandler();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("应该使用正确的依赖项初始化", () => {
      expect(configApiHandler).toBeInstanceOf(ConfigApiHandler);
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });

  describe("getConfig", () => {
    it("应该成功返回配置", async () => {
      mockConfigManager.getConfig.mockReturnValue(mockConfig);

      await configApiHandler.getConfig(mockContext);

      expect(mockConfigManager.getConfig).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith("处理获取配置请求");
      expect(mockLogger.debug).toHaveBeenCalledWith("获取配置成功");
      expect(mockContext.success).toHaveBeenCalledWith(mockConfig);
    });

    it("应该处理配置服务错误", async () => {
      const error = new Error("Config read failed");
      mockConfigManager.getConfig.mockImplementation(() => {
        throw error;
      });

      await configApiHandler.getConfig(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith("获取配置失败:", error);
      expect(mockContext.fail).toHaveBeenCalledWith(
        "CONFIG_READ_ERROR",
        "Config read failed",
        undefined,
        500
      );
    });

    it("应该处理非 Error 异常", async () => {
      mockConfigManager.getConfig.mockImplementation(() => {
        throw "String error";
      });

      await configApiHandler.getConfig(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "CONFIG_READ_ERROR",
        "获取配置失败",
        undefined,
        500
      );
    });
  });

  describe("updateConfig", () => {
    it("应该成功更新配置", async () => {
      mockContext.req.json.mockResolvedValue(mockConfig);

      await configApiHandler.updateConfig(mockContext);

      // 验证 validateConfig 被调用
      expect(mockConfigManager.validateConfig).toHaveBeenCalledWith(mockConfig);
      // 验证 updateConfig 被调用
      expect(mockConfigManager.updateConfig).toHaveBeenCalledWith(mockConfig);
      expect(mockContext.req.json).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith("处理更新配置请求");
      expect(mockLogger.info).toHaveBeenCalledWith("配置更新成功");
      expect(mockContext.success).toHaveBeenCalledWith(
        undefined,
        "配置更新成功"
      );
    });

    it("应该处理无效请求体 - null", async () => {
      mockContext.req.json.mockResolvedValue(null);
      mockConfigManager.validateConfig.mockImplementation(() => {
        throw new Error("配置必须是有效的对象");
      });

      await configApiHandler.updateConfig(mockContext);

      expect(mockConfigManager.updateConfig).not.toHaveBeenCalled();
      expect(mockContext.fail).toHaveBeenCalledWith(
        "CONFIG_UPDATE_ERROR",
        "配置必须是有效的对象"
      );
    });

    it("应该处理无效请求体 - string", async () => {
      mockContext.req.json.mockResolvedValue("invalid config");
      mockConfigManager.validateConfig.mockImplementation(() => {
        throw new Error("配置必须是有效的对象");
      });

      await configApiHandler.updateConfig(mockContext);

      expect(mockConfigManager.updateConfig).not.toHaveBeenCalled();
      expect(mockContext.fail).toHaveBeenCalledWith(
        "CONFIG_UPDATE_ERROR",
        "配置必须是有效的对象"
      );
    });

    it("应该处理配置更新错误", async () => {
      const error = new Error("Config update failed");
      mockContext.req.json.mockResolvedValue(mockConfig);
      mockConfigManager.validateConfig.mockImplementation(() => {
        throw error;
      });

      await configApiHandler.updateConfig(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith("配置更新失败:", error);
      expect(mockContext.fail).toHaveBeenCalledWith(
        "CONFIG_UPDATE_ERROR",
        "Config update failed"
      );
    });

    it("应该处理 JSON 解析错误", async () => {
      const jsonError = new Error("Invalid JSON");
      mockContext.req.json.mockRejectedValue(jsonError);

      await configApiHandler.updateConfig(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith("配置更新失败:", jsonError);
      expect(mockContext.fail).toHaveBeenCalledWith(
        "CONFIG_UPDATE_ERROR",
        "Invalid JSON"
      );
    });
  });

  describe("getMcpEndpoint", () => {
    it("应该成功返回 MCP 端点", async () => {
      const endpoint = "ws://localhost:3000";
      mockConfigManager.getMcpEndpoint.mockReturnValue(endpoint);

      await configApiHandler.getMcpEndpoint(mockContext);

      expect(mockConfigManager.getMcpEndpoint).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith("处理获取 MCP 端点请求");
      expect(mockLogger.debug).toHaveBeenCalledWith("获取 MCP 端点成功");
      expect(mockContext.success).toHaveBeenCalledWith({ endpoint });
    });

    it("应该处理 MCP 端点错误", async () => {
      const error = new Error("MCP endpoint read failed");
      mockConfigManager.getMcpEndpoint.mockImplementation(() => {
        throw error;
      });

      await configApiHandler.getMcpEndpoint(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "获取 MCP 端点失败:",
        error
      );
      expect(mockContext.fail).toHaveBeenCalledWith(
        "MCP_ENDPOINT_READ_ERROR",
        "MCP endpoint read failed",
        undefined,
        500
      );
    });
  });

  describe("getMcpEndpoints", () => {
    it("应该成功返回 MCP 端点列表", async () => {
      const endpoints = ["ws://localhost:3000", "ws://localhost:3001"];
      mockConfigManager.getMcpEndpoints.mockReturnValue(endpoints);

      await configApiHandler.getMcpEndpoints(mockContext);

      expect(mockConfigManager.getMcpEndpoints).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "处理获取 MCP 端点列表请求"
      );
      expect(mockLogger.debug).toHaveBeenCalledWith("获取 MCP 端点列表成功");
      expect(mockContext.success).toHaveBeenCalledWith({ endpoints });
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
      expect(mockContext.fail).toHaveBeenCalledWith(
        "MCP_ENDPOINTS_READ_ERROR",
        "MCP endpoints read failed",
        undefined,
        500
      );
    });
  });

  describe("getMcpServers", () => {
    it("应该成功返回 MCP 服务配置", async () => {
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
      expect(mockContext.success).toHaveBeenCalledWith({ servers });
    });

    it("应该处理 MCP 服务配置错误", async () => {
      const error = new Error("MCP servers read failed");
      mockConfigManager.getMcpServers.mockImplementation(() => {
        throw error;
      });

      await configApiHandler.getMcpServers(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "获取 MCP 服务配置失败:",
        error
      );
      expect(mockContext.fail).toHaveBeenCalledWith(
        "MCP_SERVERS_READ_ERROR",
        "MCP servers read failed",
        undefined,
        500
      );
    });
  });

  describe("getConnectionConfig", () => {
    it("应该成功返回连接配置", async () => {
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
      expect(mockContext.success).toHaveBeenCalledWith({ connection });
    });

    it("应该处理连接配置错误", async () => {
      const error = new Error("Connection config read failed");
      mockConfigManager.getConnectionConfig.mockImplementation(() => {
        throw error;
      });

      await configApiHandler.getConnectionConfig(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith("获取连接配置失败:", error);
      expect(mockContext.fail).toHaveBeenCalledWith(
        "CONNECTION_CONFIG_READ_ERROR",
        "Connection config read failed",
        undefined,
        500
      );
    });
  });

  describe("reloadConfig", () => {
    it("应该成功重新加载配置", async () => {
      mockConfigManager.getConfig.mockReturnValue(mockConfig);

      await configApiHandler.reloadConfig(mockContext);

      expect(mockConfigManager.reloadConfig).toHaveBeenCalledTimes(1);
      expect(mockConfigManager.getConfig).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith("处理重新加载配置请求");
      expect(mockLogger.info).toHaveBeenCalledWith("重新加载配置成功");
      expect(mockContext.success).toHaveBeenCalledWith(
        mockConfig,
        "配置重新加载成功"
      );
    });

    it("应该处理重新加载配置错误", async () => {
      const error = new Error("Config reload failed");
      mockConfigManager.getConfig.mockImplementation(() => {
        throw error;
      });

      await configApiHandler.reloadConfig(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith("重新加载配置失败:", error);
      expect(mockContext.fail).toHaveBeenCalledWith(
        "CONFIG_RELOAD_ERROR",
        "Config reload failed",
        undefined,
        500
      );
    });
  });

  describe("getConfigPath", () => {
    it("应该成功返回配置文件路径", async () => {
      const path = "/path/to/config.json";
      mockConfigManager.getConfigPath.mockReturnValue(path);

      await configApiHandler.getConfigPath(mockContext);

      expect(mockConfigManager.getConfigPath).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith("处理获取配置文件路径请求");
      expect(mockLogger.debug).toHaveBeenCalledWith("获取配置文件路径成功");
      expect(mockContext.success).toHaveBeenCalledWith({ path });
    });

    it("应该处理配置路径错误", async () => {
      const error = new Error("Config path read failed");
      mockConfigManager.getConfigPath.mockImplementation(() => {
        throw error;
      });

      await configApiHandler.getConfigPath(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "获取配置文件路径失败:",
        error
      );
      expect(mockContext.fail).toHaveBeenCalledWith(
        "CONFIG_PATH_READ_ERROR",
        "Config path read failed",
        undefined,
        500
      );
    });
  });

  describe("checkConfigExists", () => {
    it("应该返回 true 当配置存在时", async () => {
      mockConfigManager.configExists.mockReturnValue(true);

      await configApiHandler.checkConfigExists(mockContext);

      expect(mockConfigManager.configExists).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith("处理检查配置是否存在请求");
      expect(mockLogger.debug).toHaveBeenCalledWith("配置存在检查结果: true");
      expect(mockContext.success).toHaveBeenCalledWith({ exists: true });
    });

    it("应该返回 false 当配置不存在时", async () => {
      mockConfigManager.configExists.mockReturnValue(false);

      await configApiHandler.checkConfigExists(mockContext);

      expect(mockConfigManager.configExists).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith("处理检查配置是否存在请求");
      expect(mockLogger.debug).toHaveBeenCalledWith("配置存在检查结果: false");
      expect(mockContext.success).toHaveBeenCalledWith({ exists: false });
    });

    it("应该处理配置存在检查错误", async () => {
      const error = new Error("Config exists check failed");
      mockConfigManager.configExists.mockImplementation(() => {
        throw error;
      });

      await configApiHandler.checkConfigExists(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "检查配置是否存在失败:",
        error
      );
      expect(mockContext.fail).toHaveBeenCalledWith(
        "CONFIG_EXISTS_CHECK_ERROR",
        "Config exists check failed",
        undefined,
        500
      );
    });
  });

  describe("getPromptFiles", () => {
    it("应该成功获取提示词文件列表", async () => {
      const { listPromptFiles } = await import("@/utils/prompt-utils.js");
      const prompts = [
        { fileName: "default.md", relativePath: "./prompts/default.md" },
        { fileName: "custom.md", relativePath: "./prompts/custom.md" },
      ];
      vi.mocked(listPromptFiles).mockReturnValue(prompts);

      await configApiHandler.getPromptFiles(mockContext);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "处理获取提示词文件列表请求"
      );
      expect(mockContext.success).toHaveBeenCalledWith({ prompts });
      expect(listPromptFiles).toHaveBeenCalled();
    });

    it("应该成功获取空的提示词文件列表", async () => {
      const { listPromptFiles } = await import("@/utils/prompt-utils.js");
      vi.mocked(listPromptFiles).mockReturnValue([]);

      await configApiHandler.getPromptFiles(mockContext);

      expect(mockContext.success).toHaveBeenCalledWith({ prompts: [] });
    });

    it("应该处理获取提示词文件列表错误", async () => {
      const { listPromptFiles } = await import("@/utils/prompt-utils.js");
      vi.mocked(listPromptFiles).mockImplementation(() => {
        throw new Error("获取提示词文件列表失败");
      });

      await configApiHandler.getPromptFiles(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "获取提示词文件列表失败:",
        expect.any(Error)
      );
      expect(mockContext.fail).toHaveBeenCalledWith(
        "PROMPT_FILES_READ_ERROR",
        "获取提示词文件列表失败",
        undefined,
        500
      );
    });
  });

  describe("getPromptFileContent", () => {
    it("应该成功获取提示词文件内容", async () => {
      const { readPromptFile } = await import("@/utils/prompt-utils.js");
      const path = "./prompts/default.md";
      const fileContent = {
        fileName: "default.md",
        relativePath: path,
        content: "# 默认提示词",
      };
      mockContext.req.query = vi.fn().mockReturnValue(path);
      vi.mocked(readPromptFile).mockReturnValue(fileContent);

      await configApiHandler.getPromptFileContent(mockContext);

      expect(mockContext.success).toHaveBeenCalledWith(fileContent);
      expect(readPromptFile).toHaveBeenCalledWith(path);
    });

    it("应该在缺少 path 参数时返回错误", async () => {
      mockContext.req.query = vi.fn().mockReturnValue(undefined);

      await configApiHandler.getPromptFileContent(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_REQUEST",
        "缺少 path 参数",
        undefined,
        400
      );
    });

    it("应该处理读取提示词文件错误", async () => {
      const { readPromptFile } = await import("@/utils/prompt-utils.js");
      const path = "./prompts/nonexistent.md";
      mockContext.req.query = vi.fn().mockReturnValue(path);
      vi.mocked(readPromptFile).mockImplementation(() => {
        throw new Error("文件不存在");
      });

      await configApiHandler.getPromptFileContent(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "PROMPT_FILE_READ_ERROR",
        "文件不存在",
        undefined,
        400
      );
    });
  });

  describe("updatePromptFileContent", () => {
    it("应该成功更新提示词文件内容", async () => {
      const { updatePromptFile } = await import("@/utils/prompt-utils.js");
      const body = {
        path: "./prompts/default.md",
        content: "更新的提示词内容",
      };
      const fileContent = {
        fileName: "default.md",
        relativePath: body.path,
        content: body.content,
      };
      mockContext.req.json.mockResolvedValue(body);
      vi.mocked(updatePromptFile).mockReturnValue(fileContent);

      await configApiHandler.updatePromptFileContent(mockContext);

      expect(mockContext.success).toHaveBeenCalledWith(
        fileContent,
        "提示词文件更新成功"
      );
      expect(updatePromptFile).toHaveBeenCalledWith(body.path, body.content);
    });

    it("应该在请求体格式错误时返回错误", async () => {
      mockContext.req.json.mockResolvedValue(null);

      await configApiHandler.updatePromptFileContent(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_REQUEST",
        "请求体格式错误",
        undefined,
        400
      );
    });

    it("应该在缺少 path 参数时返回错误", async () => {
      mockContext.req.json.mockResolvedValue({ content: "内容" });

      await configApiHandler.updatePromptFileContent(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_REQUEST",
        "path 参数必须是字符串",
        undefined,
        400
      );
    });

    it("应该在 path 参数类型错误时返回错误", async () => {
      mockContext.req.json.mockResolvedValue({ path: 123, content: "内容" });

      await configApiHandler.updatePromptFileContent(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_REQUEST",
        "path 参数必须是字符串",
        undefined,
        400
      );
    });

    it("应该在缺少 content 参数时返回错误", async () => {
      mockContext.req.json.mockResolvedValue({ path: "./prompts/default.md" });

      await configApiHandler.updatePromptFileContent(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_REQUEST",
        "content 参数必须是字符串",
        undefined,
        400
      );
    });

    it("应该在 content 参数类型错误时返回错误", async () => {
      mockContext.req.json.mockResolvedValue({
        path: "./prompts/default.md",
        content: 123,
      });

      await configApiHandler.updatePromptFileContent(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_REQUEST",
        "content 参数必须是字符串",
        undefined,
        400
      );
    });

    it("应该处理更新提示词文件错误", async () => {
      const { updatePromptFile } = await import("@/utils/prompt-utils.js");
      const body = {
        path: "./prompts/default.md",
        content: "更新的内容",
      };
      mockContext.req.json.mockResolvedValue(body);
      vi.mocked(updatePromptFile).mockImplementation(() => {
        throw new Error("文件不存在");
      });

      await configApiHandler.updatePromptFileContent(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "PROMPT_FILE_UPDATE_ERROR",
        "文件不存在",
        undefined,
        400
      );
    });
  });

  describe("createPromptFileContent", () => {
    it("应该成功创建提示词文件", async () => {
      const { createPromptFile } = await import("@/utils/prompt-utils.js");
      const body = {
        fileName: "custom.md",
        content: "自定义提示词内容",
      };
      const fileContent = {
        fileName: body.fileName,
        relativePath: `./prompts/${body.fileName}`,
        content: body.content,
      };
      mockContext.req.json.mockResolvedValue(body);
      vi.mocked(createPromptFile).mockReturnValue(fileContent);

      await configApiHandler.createPromptFileContent(mockContext);

      expect(mockContext.success).toHaveBeenCalledWith(
        fileContent,
        "提示词文件创建成功"
      );
      expect(createPromptFile).toHaveBeenCalledWith(
        body.fileName,
        body.content
      );
    });

    it("应该在请求体格式错误时返回错误", async () => {
      mockContext.req.json.mockResolvedValue(null);

      await configApiHandler.createPromptFileContent(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_REQUEST",
        "请求体格式错误",
        undefined,
        400
      );
    });

    it("应该在缺少 fileName 参数时返回错误", async () => {
      mockContext.req.json.mockResolvedValue({ content: "内容" });

      await configApiHandler.createPromptFileContent(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_REQUEST",
        "fileName 参数必须是字符串",
        undefined,
        400
      );
    });

    it("应该在 fileName 参数类型错误时返回错误", async () => {
      mockContext.req.json.mockResolvedValue({
        fileName: 123,
        content: "内容",
      });

      await configApiHandler.createPromptFileContent(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_REQUEST",
        "fileName 参数必须是字符串",
        undefined,
        400
      );
    });

    it("应该在缺少 content 参数时返回错误", async () => {
      mockContext.req.json.mockResolvedValue({ fileName: "custom.md" });

      await configApiHandler.createPromptFileContent(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_REQUEST",
        "content 参数必须是字符串",
        undefined,
        400
      );
    });

    it("应该在 content 参数类型错误时返回错误", async () => {
      mockContext.req.json.mockResolvedValue({
        fileName: "custom.md",
        content: 123,
      });

      await configApiHandler.createPromptFileContent(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_REQUEST",
        "content 参数必须是字符串",
        undefined,
        400
      );
    });

    it("应该处理创建提示词文件错误", async () => {
      const { createPromptFile } = await import("@/utils/prompt-utils.js");
      const body = {
        fileName: "custom.md",
        content: "内容",
      };
      mockContext.req.json.mockResolvedValue(body);
      vi.mocked(createPromptFile).mockImplementation(() => {
        throw new Error("文件已存在");
      });

      await configApiHandler.createPromptFileContent(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "PROMPT_FILE_CREATE_ERROR",
        "文件已存在",
        undefined,
        400
      );
    });
  });

  describe("deletePromptFileContent", () => {
    it("应该成功删除提示词文件", async () => {
      const { deletePromptFile } = await import("@/utils/prompt-utils.js");
      const path = "./prompts/old-prompt.md";
      mockContext.req.query = vi.fn().mockReturnValue(path);
      vi.mocked(deletePromptFile).mockReturnValue(undefined);

      await configApiHandler.deletePromptFileContent(mockContext);

      expect(mockContext.success).toHaveBeenCalledWith(
        undefined,
        "提示词文件删除成功"
      );
      expect(deletePromptFile).toHaveBeenCalledWith(path);
    });

    it("应该在缺少 path 参数时返回错误", async () => {
      mockContext.req.query = vi.fn().mockReturnValue(undefined);

      await configApiHandler.deletePromptFileContent(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_REQUEST",
        "缺少 path 参数",
        undefined,
        400
      );
    });

    it("应该处理删除提示词文件错误", async () => {
      const { deletePromptFile } = await import("@/utils/prompt-utils.js");
      const path = "./prompts/nonexistent.md";
      mockContext.req.query = vi.fn().mockReturnValue(path);
      vi.mocked(deletePromptFile).mockImplementation(() => {
        throw new Error("文件不存在");
      });

      await configApiHandler.deletePromptFileContent(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "PROMPT_FILE_DELETE_ERROR",
        "文件不存在",
        undefined,
        400
      );
    });
  });

  describe("边界情况和错误处理", () => {
    it("应该正确处理非 Error 类型的异常", async () => {
      mockConfigManager.getConfig.mockImplementation(() => {
        throw "字符串错误";
      });

      await configApiHandler.getConfig(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "CONFIG_READ_ERROR",
        "获取配置失败",
        undefined,
        500
      );
    });

    it("应该正确处理 null 错误对象", async () => {
      mockConfigManager.getConfig.mockImplementation(() => {
        throw null;
      });

      await configApiHandler.getConfig(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "CONFIG_READ_ERROR",
        "获取配置失败",
        undefined,
        500
      );
    });

    it("应该正确处理 undefined 错误对象", async () => {
      mockConfigManager.getConfig.mockImplementation(() => {
        throw undefined;
      });

      await configApiHandler.getConfig(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "CONFIG_READ_ERROR",
        "获取配置失败",
        undefined,
        500
      );
    });
  });
});
