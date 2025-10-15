import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "../../Logger.js";
import { NPMManager } from "../NPMManager.js";

// Mock dependencies
vi.mock("node:child_process");
vi.mock("../../Logger.js");

describe("NPMManager", () => {
  let npmManager: NPMManager;
  let mockExec: any;
  let mockLogger: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };
    (logger.withTag as any).mockReturnValue(mockLogger);

    // Setup mock exec
    mockExec = vi.mocked(require("node:child_process").exec);

    // Create NPMManager instance
    npmManager = new NPMManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("installVersion", () => {
    test("应该成功执行 npm install 命令", async () => {
      // Arrange
      const version = "1.7.9";
      const mockStdout = "Package installed successfully";
      const mockStderr = "";
      const mockVersionOutput = JSON.stringify({
        dependencies: {
          "xiaozhi-client": {
            version: "1.7.9",
          },
        },
      });

      const execMock = mockExec as any;
      execMock.mockImplementation((command: string) => {
        if (command.includes("npm install")) {
          return Promise.resolve({ stdout: mockStdout, stderr: mockStderr });
        }
        if (command.includes("npm list")) {
          return Promise.resolve({ stdout: mockVersionOutput });
        }
        return Promise.reject(new Error("Unknown command"));
      });

      // Act
      await npmManager.installVersion(version);

      // Assert
      expect(mockExec).toHaveBeenCalledWith(
        "npm install -g xiaozhi-client@1.7.9 --registry=https://registry.npmmirror.com"
      );
      expect(mockExec).toHaveBeenCalledWith(
        "npm list -g xiaozhi-client --depth=0 --json"
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        "执行安装: xiaozhi-client@1.7.9"
      );
      expect(mockLogger.info).toHaveBeenCalledWith("安装命令执行完成");
      expect(mockLogger.info).toHaveBeenCalledWith("当前版本: 1.7.9");
      expect(mockLogger.debug).toHaveBeenCalledWith("npm stdout:", mockStdout);
    });

    test("应该处理 npm install 输出警告信息", async () => {
      // Arrange
      const version = "1.7.9";
      const mockStdout = "Package installed successfully";
      const mockStderr = "npm WARN optional package not installed";
      const mockVersionOutput = JSON.stringify({
        dependencies: {
          "xiaozhi-client": {
            version: "1.7.9",
          },
        },
      });

      const execMock = mockExec as any;
      execMock.mockImplementation((command: string) => {
        if (command.includes("npm install")) {
          return Promise.resolve({ stdout: mockStdout, stderr: mockStderr });
        }
        if (command.includes("npm list")) {
          return Promise.resolve({ stdout: mockVersionOutput });
        }
        return Promise.reject(new Error("Unknown command"));
      });

      // Act
      await npmManager.installVersion(version);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith("npm stderr:", mockStderr);
    });

    test("应该处理版本验证失败的情况", async () => {
      // Arrange
      const version = "1.7.9";
      const mockStdout = "Package installed successfully";
      const mockStderr = "";
      const versionError = new Error("Version check failed");

      const execMock = mockExec as any;
      execMock.mockImplementation((command: string) => {
        if (command.includes("npm install")) {
          return Promise.resolve({ stdout: mockStdout, stderr: mockStderr });
        }
        if (command.includes("npm list")) {
          return Promise.reject(versionError);
        }
        return Promise.reject(new Error("Unknown command"));
      });

      // Act & Assert
      await expect(npmManager.installVersion(version)).rejects.toThrow(
        "安装验证失败"
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        "版本验证失败:",
        versionError
      );
    });

    test("应该处理 npm install 失败的情况", async () => {
      // Arrange
      const version = "1.7.9";
      const installError = new Error("npm install failed");

      const execMock = mockExec as any;
      execMock.mockReturnValue(Promise.reject(installError));

      // Act & Assert
      await expect(npmManager.installVersion(version)).rejects.toThrow(
        installError
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        "执行安装: xiaozhi-client@1.7.9"
      );
    });

    test("应该记录正确的日志信息", async () => {
      // Arrange
      const version = "2.0.0";
      const mockStdout = "Package installed successfully";
      const mockStderr = "";
      const mockVersionOutput = JSON.stringify({
        dependencies: {
          "xiaozhi-client": {
            version: "2.0.0",
          },
        },
      });

      const execMock = mockExec as any;
      execMock.mockImplementation((command: string) => {
        if (command.includes("npm install")) {
          return Promise.resolve({ stdout: mockStdout, stderr: mockStderr });
        }
        if (command.includes("npm list")) {
          return Promise.resolve({ stdout: mockVersionOutput });
        }
        return Promise.reject(new Error("Unknown command"));
      });

      // Act
      await npmManager.installVersion(version);

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        "执行安装: xiaozhi-client@2.0.0"
      );
      expect(mockLogger.info).toHaveBeenCalledWith("安装命令执行完成");
      expect(mockLogger.debug).toHaveBeenCalledWith("npm stdout:", mockStdout);
      expect(mockLogger.info).toHaveBeenCalledWith("当前版本: 2.0.0");
    });
  });

  describe("getCurrentVersion", () => {
    test("应该成功获取当前版本", async () => {
      // Arrange
      const expectedVersion = "1.7.8";
      const mockOutput = JSON.stringify({
        dependencies: {
          "xiaozhi-client": {
            version: expectedVersion,
          },
        },
      });

      const execMock = mockExec as any;
      execMock.mockReturnValue(Promise.resolve({ stdout: mockOutput }));

      // Act
      const result = await npmManager.getCurrentVersion();

      // Assert
      expect(result).toBe(expectedVersion);
      expect(mockExec).toHaveBeenCalledWith(
        "npm list -g xiaozhi-client --depth=0 --json"
      );
    });

    test("应该处理包未安装的情况", async () => {
      // Arrange
      const mockOutput = JSON.stringify({
        dependencies: {},
      });

      const execMock = mockExec as any;
      execMock.mockReturnValue(Promise.resolve({ stdout: mockOutput }));

      // Act
      const result = await npmManager.getCurrentVersion();

      // Assert
      expect(result).toBe("unknown");
    });

    test("应该处理 npm list 输出中没有 dependencies 字段的情况", async () => {
      // Arrange
      const mockOutput = JSON.stringify({});

      const execMock = mockExec as any;
      execMock.mockReturnValue(Promise.resolve({ stdout: mockOutput }));

      // Act
      const result = await npmManager.getCurrentVersion();

      // Assert
      expect(result).toBe("unknown");
    });

    test("应该处理 npm list 命令失败的情况", async () => {
      // Arrange
      const listError = new Error("npm list failed");

      const execMock = mockExec as any;
      execMock.mockReturnValue(Promise.reject(listError));

      // Act & Assert
      await expect(npmManager.getCurrentVersion()).rejects.toThrow(listError);
    });

    test("应该处理无效的 JSON 输出", async () => {
      // Arrange
      const invalidJson = "{ invalid json }";

      const execMock = mockExec as any;
      execMock.mockReturnValue(Promise.resolve({ stdout: invalidJson }));

      // Act & Assert
      await expect(npmManager.getCurrentVersion()).rejects.toThrow();
    });
  });
});
