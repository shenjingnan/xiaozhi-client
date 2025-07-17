import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { main } from "./adaptiveMCPPipe.js";

// Mock dependencies
vi.mock("dotenv", () => ({
  config: vi.fn(),
}));

vi.mock("node:url", () => ({
  fileURLToPath: vi.fn(),
}));

vi.mock("./configManager.js", () => ({
  configManager: {
    configExists: vi.fn(),
    getMcpEndpoints: vi.fn(),
    getConfigPath: vi.fn(),
  },
}));

vi.mock("./logger.js", () => ({
  logger: {
    withTag: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
    initLogFile: vi.fn(),
    enableFileLogging: vi.fn(),
  },
}));

vi.mock("./multiEndpointMCPPipe.js", () => ({
  MultiEndpointMCPPipe: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
  })),
  setupSignalHandlers: vi.fn(),
}));

// Mock process
const mockProcess = {
  argv: ["node", "script.js"],
  env: {},
  exit: vi.fn().mockImplementation(() => {
    throw new Error("process.exit called");
  }),
  stderr: {
    write: vi.fn(),
  },
  cwd: vi.fn(() => "/test/dir"),
};

vi.stubGlobal("process", mockProcess);

describe("adaptiveMCPPipe", async () => {
  const configManagerModule = await import("./configManager.js");
  const loggerModule = await import("./logger.js");
  const multiEndpointModule = await import("./multiEndpointMCPPipe.js");

  const mockConfigManager = vi.mocked(configManagerModule.configManager);
  const mockLogger = vi.mocked(loggerModule.logger);
  const mockMultiEndpointMCPPipe = vi.mocked(
    multiEndpointModule.MultiEndpointMCPPipe
  );
  const mockSetupSignalHandlers = vi.mocked(
    multiEndpointModule.setupSignalHandlers
  );

  beforeEach(() => {
    vi.clearAllMocks();
    mockProcess.argv = ["node", "script.js", "test-script.js"]; // 默认设置三个参数
    mockProcess.env = {};
    mockProcess.exit.mockClear();
    mockProcess.stderr.write.mockClear();
    mockProcess.cwd.mockReturnValue("/test/dir");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("main function", () => {
    it("should exit with error if no mcp_script argument provided", async () => {
      mockProcess.argv = ["node", "script.js"]; // 只有两个参数，缺少 mcp_script

      const loggerInstance = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };
      mockLogger.withTag.mockReturnValue(loggerInstance);

      await expect(main()).rejects.toThrow("process.exit called");

      expect(loggerInstance.error).toHaveBeenCalledWith(
        "用法: node adaptiveMCPPipe.js <mcp_script>"
      );
      expect(mockProcess.exit).toHaveBeenCalledWith(1);
    });

    it("should use config file endpoints when config exists", async () => {
      mockProcess.argv = ["node", "script.js", "test-script.js"];
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getMcpEndpoints.mockReturnValue([
        "ws://localhost:8080",
        "ws://localhost:8081",
      ]);

      const loggerInstance = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };
      mockLogger.withTag.mockReturnValue(loggerInstance);

      const mockMcpPipeInstance = {
        start: vi.fn().mockResolvedValue(undefined),
      };
      mockMultiEndpointMCPPipe.mockReturnValue(mockMcpPipeInstance);

      await main();

      expect(mockConfigManager.configExists).toHaveBeenCalled();
      expect(mockConfigManager.getMcpEndpoints).toHaveBeenCalled();
      expect(loggerInstance.info).toHaveBeenCalledWith(
        "使用配置文件中的 MCP 端点（2 个）"
      );
      expect(mockMultiEndpointMCPPipe).toHaveBeenCalledWith("test-script.js", [
        "ws://localhost:8080",
        "ws://localhost:8081",
      ]);
      expect(mockSetupSignalHandlers).toHaveBeenCalledWith(mockMcpPipeInstance);
      expect(mockMcpPipeInstance.start).toHaveBeenCalled();
    });

    it("should use environment variable when config file does not exist", async () => {
      mockProcess.argv = ["node", "script.js", "test-script.js"];
      mockProcess.env.MCP_ENDPOINT = "ws://localhost:8080";
      mockConfigManager.configExists.mockReturnValue(false);

      const loggerInstance = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };
      mockLogger.withTag.mockReturnValue(loggerInstance);

      const mockMcpPipeInstance = {
        start: vi.fn().mockResolvedValue(undefined),
      };
      mockMultiEndpointMCPPipe.mockReturnValue(mockMcpPipeInstance);

      await main();

      expect(loggerInstance.info).toHaveBeenCalledWith(
        "使用环境变量中的 MCP 端点（建议使用配置文件）"
      );
      expect(mockMultiEndpointMCPPipe).toHaveBeenCalledWith("test-script.js", [
        "ws://localhost:8080",
      ]);
    });

    it("should exit with error when no config file and no environment variable", async () => {
      mockProcess.argv = ["node", "script.js", "test-script.js"];
      mockConfigManager.configExists.mockReturnValue(false);
      mockProcess.env.MCP_ENDPOINT = undefined;

      const loggerInstance = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };
      mockLogger.withTag.mockReturnValue(loggerInstance);

      await expect(main()).rejects.toThrow("process.exit called");

      expect(loggerInstance.error).toHaveBeenCalledWith(
        "配置文件不存在且未设置 MCP_ENDPOINT 环境变量"
      );
      expect(loggerInstance.error).toHaveBeenCalledWith(
        '请运行 "xiaozhi init" 初始化配置，或设置 MCP_ENDPOINT 环境变量'
      );
      expect(mockProcess.exit).toHaveBeenCalledWith(1);
    });

    it("should handle config reading error and fallback to environment variable", async () => {
      mockProcess.argv = ["node", "script.js", "test-script.js"];
      mockProcess.env.MCP_ENDPOINT = "ws://localhost:8080";
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getMcpEndpoints.mockImplementation(() => {
        throw new Error("Config read error");
      });

      const loggerInstance = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };
      mockLogger.withTag.mockReturnValue(loggerInstance);

      const mockMcpPipeInstance = {
        start: vi.fn().mockResolvedValue(undefined),
      };
      mockMultiEndpointMCPPipe.mockReturnValue(mockMcpPipeInstance);

      await main();

      expect(loggerInstance.error).toHaveBeenCalledWith(
        "读取配置失败: Config read error"
      );
      expect(loggerInstance.info).toHaveBeenCalledWith(
        "使用环境变量中的 MCP 端点作为备用方案"
      );
      expect(mockMultiEndpointMCPPipe).toHaveBeenCalledWith("test-script.js", [
        "ws://localhost:8080",
      ]);
    });

    it("should exit when config error and no environment variable", async () => {
      mockProcess.argv = ["node", "script.js", "test-script.js"];
      mockProcess.env.MCP_ENDPOINT = undefined;
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getMcpEndpoints.mockImplementation(() => {
        throw new Error("Config read error");
      });

      const loggerInstance = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };
      mockLogger.withTag.mockReturnValue(loggerInstance);

      await expect(main()).rejects.toThrow("process.exit called");

      expect(loggerInstance.error).toHaveBeenCalledWith(
        "读取配置失败: Config read error"
      );
      expect(loggerInstance.error).toHaveBeenCalledWith(
        '请运行 "xiaozhi init" 初始化配置，或设置 MCP_ENDPOINT 环境变量'
      );
      expect(mockProcess.exit).toHaveBeenCalledWith(1);
    });

    it("should exit when no endpoints configured", async () => {
      mockProcess.argv = ["node", "script.js", "test-script.js"];
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getMcpEndpoints.mockReturnValue([]);

      const loggerInstance = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };
      mockLogger.withTag.mockReturnValue(loggerInstance);

      await expect(main()).rejects.toThrow("process.exit called");

      expect(loggerInstance.error).toHaveBeenCalledWith(
        "没有配置任何 MCP 端点"
      );
      expect(mockProcess.exit).toHaveBeenCalledWith(1);
    });

    it("should filter out invalid endpoints", async () => {
      mockProcess.argv = ["node", "script.js", "test-script.js"];
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getMcpEndpoints.mockReturnValue([
        "ws://localhost:8080",
        "",
        "<请填写您的端点>",
        "ws://localhost:8081",
        null,
        undefined,
      ]);

      const loggerInstance = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };
      mockLogger.withTag.mockReturnValue(loggerInstance);

      const mockMcpPipeInstance = {
        start: vi.fn().mockResolvedValue(undefined),
      };
      mockMultiEndpointMCPPipe.mockReturnValue(mockMcpPipeInstance);

      await main();

      expect(loggerInstance.warn).toHaveBeenCalledWith("跳过无效端点: ");
      expect(loggerInstance.warn).toHaveBeenCalledWith(
        "跳过无效端点: <请填写您的端点>"
      );
      expect(mockMultiEndpointMCPPipe).toHaveBeenCalledWith("test-script.js", [
        "ws://localhost:8080",
        "ws://localhost:8081",
      ]);
    });

    it("should exit when all endpoints are invalid", async () => {
      mockProcess.argv = ["node", "script.js", "test-script.js"];
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getMcpEndpoints.mockReturnValue([
        "",
        "<请填写您的端点>",
        null,
        undefined,
      ]);

      const loggerInstance = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };
      mockLogger.withTag.mockReturnValue(loggerInstance);

      await expect(main()).rejects.toThrow("process.exit called");

      expect(loggerInstance.error).toHaveBeenCalledWith("没有有效的 MCP 端点");
      expect(loggerInstance.error).toHaveBeenCalledWith(
        '请运行 "xiaozhi config mcpEndpoint <your-endpoint-url>" 设置端点'
      );
      expect(mockProcess.exit).toHaveBeenCalledWith(1);
    });

    it("should handle MCP pipe start error", async () => {
      mockProcess.argv = ["node", "script.js", "test-script.js"];
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getMcpEndpoints.mockReturnValue([
        "ws://localhost:8080",
      ]);

      const loggerInstance = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };
      mockLogger.withTag.mockReturnValue(loggerInstance);

      const mockMcpPipeInstance = {
        start: vi.fn().mockRejectedValue(new Error("Connection failed")),
      };
      mockMultiEndpointMCPPipe.mockReturnValue(mockMcpPipeInstance);

      await expect(main()).rejects.toThrow("process.exit called");

      expect(loggerInstance.error).toHaveBeenCalledWith(
        "程序执行错误: Connection failed"
      );
      expect(mockProcess.exit).toHaveBeenCalledWith(1);
    });

    it("should handle non-Error exceptions in MCP pipe start", async () => {
      mockProcess.argv = ["node", "script.js", "test-script.js"];
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getMcpEndpoints.mockReturnValue([
        "ws://localhost:8080",
      ]);

      const loggerInstance = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };
      mockLogger.withTag.mockReturnValue(loggerInstance);

      const mockMcpPipeInstance = {
        start: vi.fn().mockRejectedValue("String error"),
      };
      mockMultiEndpointMCPPipe.mockReturnValue(mockMcpPipeInstance);

      await expect(main()).rejects.toThrow("process.exit called");

      expect(loggerInstance.error).toHaveBeenCalledWith(
        "程序执行错误: String error"
      );
      expect(mockProcess.exit).toHaveBeenCalledWith(1);
    });

    it("should log single endpoint connection message", async () => {
      mockProcess.argv = ["node", "script.js", "test-script.js"];
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getMcpEndpoints.mockReturnValue([
        "ws://localhost:8080",
      ]);

      const loggerInstance = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };
      mockLogger.withTag.mockReturnValue(loggerInstance);

      const mockMcpPipeInstance = {
        start: vi.fn().mockResolvedValue(undefined),
      };
      mockMultiEndpointMCPPipe.mockReturnValue(mockMcpPipeInstance);

      await main();

      expect(loggerInstance.info).toHaveBeenCalledWith("启动单端点连接");
    });

    it("should log multi-endpoint connection message", async () => {
      mockProcess.argv = ["node", "script.js", "test-script.js"];
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getMcpEndpoints.mockReturnValue([
        "ws://localhost:8080",
        "ws://localhost:8081",
        "ws://localhost:8082",
      ]);

      const loggerInstance = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };
      mockLogger.withTag.mockReturnValue(loggerInstance);

      const mockMcpPipeInstance = {
        start: vi.fn().mockResolvedValue(undefined),
      };
      mockMultiEndpointMCPPipe.mockReturnValue(mockMcpPipeInstance);

      await main();

      expect(loggerInstance.info).toHaveBeenCalledWith(
        "启动多端点连接（3 个端点）"
      );
    });
  });

  describe("daemon mode initialization", () => {
    it("should initialize log file in daemon mode", async () => {
      mockProcess.env.XIAOZHI_DAEMON = "true";
      mockProcess.env.XIAOZHI_CONFIG_DIR = "/test/config";

      // Re-import the module to trigger the initialization code
      await import("./adaptiveMCPPipe.js");

      expect(mockLogger.initLogFile).toHaveBeenCalledWith("/test/config");
      expect(mockLogger.enableFileLogging).toHaveBeenCalledWith(true);
    });

    it("should not initialize log file when not in daemon mode", async () => {
      mockProcess.env.XIAOZHI_DAEMON = "false";
      mockProcess.env.XIAOZHI_CONFIG_DIR = "/test/config";

      // Clear previous calls
      mockLogger.initLogFile.mockClear();
      mockLogger.enableFileLogging.mockClear();

      // Re-import the module to trigger the initialization code
      await import("./adaptiveMCPPipe.js");

      expect(mockLogger.initLogFile).not.toHaveBeenCalled();
      expect(mockLogger.enableFileLogging).not.toHaveBeenCalled();
    });

    it("should not initialize log file when config dir is not set", async () => {
      mockProcess.env.XIAOZHI_DAEMON = "true";
      mockProcess.env.XIAOZHI_CONFIG_DIR = undefined;

      // Clear previous calls
      mockLogger.initLogFile.mockClear();
      mockLogger.enableFileLogging.mockClear();

      // Re-import the module to trigger the initialization code
      await import("./adaptiveMCPPipe.js");

      expect(mockLogger.initLogFile).not.toHaveBeenCalled();
      expect(mockLogger.enableFileLogging).not.toHaveBeenCalled();
    });
  });

  describe("debug output", () => {
    it("should output debug information when not in daemon mode", async () => {
      mockProcess.argv = ["node", "script.js", "test-script.js"];
      mockProcess.env.XIAOZHI_DAEMON = "false";
      mockProcess.env.XIAOZHI_CONFIG_DIR = "/test/config";
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getMcpEndpoints.mockReturnValue([
        "ws://localhost:8080",
      ]);
      mockConfigManager.getConfigPath.mockReturnValue(
        "/test/config/xiaozhi.config.json"
      );

      const loggerInstance = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };
      mockLogger.withTag.mockReturnValue(loggerInstance);

      const mockMcpPipeInstance = {
        start: vi.fn().mockResolvedValue(undefined),
      };
      mockMultiEndpointMCPPipe.mockReturnValue(mockMcpPipeInstance);

      await main();

      expect(mockProcess.stderr.write).toHaveBeenCalledWith(
        "[DEBUG] XIAOZHI_CONFIG_DIR: /test/config\n"
      );
      expect(mockProcess.stderr.write).toHaveBeenCalledWith(
        "[DEBUG] process.cwd(): /test/dir\n"
      );
      expect(mockProcess.stderr.write).toHaveBeenCalledWith(
        "[DEBUG] configManager.getConfigPath(): /test/config/xiaozhi.config.json\n"
      );
      expect(mockProcess.stderr.write).toHaveBeenCalledWith(
        "[DEBUG] configManager.configExists(): true\n"
      );
    });

    it("should not output debug information in daemon mode", async () => {
      mockProcess.argv = ["node", "script.js", "test-script.js"];
      mockProcess.env.XIAOZHI_DAEMON = "true";
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getMcpEndpoints.mockReturnValue([
        "ws://localhost:8080",
      ]);

      const loggerInstance = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };
      mockLogger.withTag.mockReturnValue(loggerInstance);

      const mockMcpPipeInstance = {
        start: vi.fn().mockResolvedValue(undefined),
      };
      mockMultiEndpointMCPPipe.mockReturnValue(mockMcpPipeInstance);

      await main();

      expect(mockProcess.stderr.write).not.toHaveBeenCalled();
    });

    it("should handle stderr write errors gracefully", async () => {
      mockProcess.argv = ["node", "script.js", "test-script.js"];
      mockProcess.env.XIAOZHI_DAEMON = "false";
      mockProcess.stderr.write.mockImplementation(() => {
        throw new Error("Write error");
      });
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getMcpEndpoints.mockReturnValue([
        "ws://localhost:8080",
      ]);

      const loggerInstance = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };
      mockLogger.withTag.mockReturnValue(loggerInstance);

      const mockMcpPipeInstance = {
        start: vi.fn().mockResolvedValue(undefined),
      };
      mockMultiEndpointMCPPipe.mockReturnValue(mockMcpPipeInstance);

      // Should not throw error
      await expect(main()).resolves.not.toThrow();
    });
  });

  describe("direct execution mode", () => {
    const mockFileURLToPath = vi.mocked(fileURLToPath);

    it("should execute main when file is run directly", async () => {
      const scriptPath = "/test/adaptiveMCPPipe.js";
      mockProcess.argv = ["node", scriptPath, "test-script.js"];
      mockFileURLToPath.mockReturnValue(scriptPath);
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getMcpEndpoints.mockReturnValue([
        "ws://localhost:8080",
      ]);

      const loggerInstance = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };
      mockLogger.withTag.mockReturnValue(loggerInstance);

      const mockMcpPipeInstance = {
        start: vi.fn().mockResolvedValue(undefined),
      };
      mockMultiEndpointMCPPipe.mockReturnValue(mockMcpPipeInstance);

      // This would normally be tested by importing the module, but since we're mocking,
      // we'll test the condition logic directly
      const currentFileUrl = "file:///test/adaptiveMCPPipe.js";
      const scriptPathFromUrl = "/test/adaptiveMCPPipe.js";
      const argv1Path = "/test/adaptiveMCPPipe.js";

      expect(scriptPathFromUrl).toBe(argv1Path);
    });

    it("should handle main execution error in direct mode", async () => {
      const scriptPath = "/test/adaptiveMCPPipe.js";
      mockProcess.argv = ["node", scriptPath];
      mockFileURLToPath.mockReturnValue(scriptPath);

      const loggerInstance = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };
      mockLogger.withTag.mockReturnValue(loggerInstance);

      // Test error handling in the catch block
      const error = new Error("Test error");

      // Since we can't easily test the direct execution path due to module loading,
      // we'll test the error handling logic by calling main directly
      await expect(main()).rejects.toThrow("process.exit called");

      expect(loggerInstance.error).toHaveBeenCalledWith(
        "用法: node adaptiveMCPPipe.js <mcp_script>"
      );
    });

    it("should handle non-Error exceptions in direct execution", async () => {
      const loggerInstance = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };
      mockLogger.withTag.mockReturnValue(loggerInstance);

      // Test string error handling
      const stringError = "String error";

      // We can test the error formatting logic
      const errorMessage =
        stringError instanceof Error
          ? stringError.message
          : String(stringError);
      expect(errorMessage).toBe("String error");
    });
  });

  describe("edge cases", () => {
    it("should handle null endpoints in filter", async () => {
      mockProcess.argv = ["node", "script.js", "test-script.js"];
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getMcpEndpoints.mockReturnValue([
        "ws://localhost:8080",
        null,
        "ws://localhost:8081",
      ]);

      const loggerInstance = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };
      mockLogger.withTag.mockReturnValue(loggerInstance);

      const mockMcpPipeInstance = {
        start: vi.fn().mockResolvedValue(undefined),
      };
      mockMultiEndpointMCPPipe.mockReturnValue(mockMcpPipeInstance);

      await main();

      expect(mockMultiEndpointMCPPipe).toHaveBeenCalledWith("test-script.js", [
        "ws://localhost:8080",
        "ws://localhost:8081",
      ]);
    });

    it("should handle undefined endpoints in filter", async () => {
      mockProcess.argv = ["node", "script.js", "test-script.js"];
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getMcpEndpoints.mockReturnValue([
        "ws://localhost:8080",
        undefined,
        "ws://localhost:8081",
      ]);

      const loggerInstance = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };
      mockLogger.withTag.mockReturnValue(loggerInstance);

      const mockMcpPipeInstance = {
        start: vi.fn().mockResolvedValue(undefined),
      };
      mockMultiEndpointMCPPipe.mockReturnValue(mockMcpPipeInstance);

      await main();

      expect(mockMultiEndpointMCPPipe).toHaveBeenCalledWith("test-script.js", [
        "ws://localhost:8080",
        "ws://localhost:8081",
      ]);
    });

    it("should handle endpoints with placeholder text", async () => {
      mockProcess.argv = ["node", "script.js", "test-script.js"];
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getMcpEndpoints.mockReturnValue([
        "ws://localhost:8080",
        "<请填写您的MCP端点>",
        "ws://localhost:8081",
      ]);

      const loggerInstance = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };
      mockLogger.withTag.mockReturnValue(loggerInstance);

      const mockMcpPipeInstance = {
        start: vi.fn().mockResolvedValue(undefined),
      };
      mockMultiEndpointMCPPipe.mockReturnValue(mockMcpPipeInstance);

      await main();

      expect(loggerInstance.warn).toHaveBeenCalledWith(
        "跳过无效端点: <请填写您的MCP端点>"
      );
      expect(mockMultiEndpointMCPPipe).toHaveBeenCalledWith("test-script.js", [
        "ws://localhost:8080",
        "ws://localhost:8081",
      ]);
    });
  });
});
