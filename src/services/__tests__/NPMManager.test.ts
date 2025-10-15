import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "../../Logger.js";
import { NPMManager } from "../NPMManager.js";
import { EventBus } from "../EventBus.js";

// Mock dependencies
vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
  exec: vi.fn(),
}));

vi.mock("node:util", () => ({
  promisify: vi.fn(),
}));

vi.mock("../../Logger.js");
vi.mock("../EventBus.js", () => ({
  EventBus: vi.fn(),
  getEventBus: vi.fn(() => ({
    emitEvent: vi.fn(),
  })),
}));

describe("NPMManager", () => {
  let npmManager: NPMManager;
  let mockLogger: any;
  let mockEventBus: any;
  let mockSpawn: any;
  let mockPromisify: any;

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

    // Setup mock event bus
    mockEventBus = {
      emitEvent: vi.fn(),
    };

    // Get mock functions
    const { spawn } = require("node:child_process");
    mockSpawn = spawn;

    const { promisify } = require("node:util");
    mockPromisify = promisify;

    // Create NPMManager instance
    npmManager = new NPMManager(mockEventBus);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    test("应该使用注入的 EventBus", () => {
      // Act
      const manager = new NPMManager(mockEventBus);

      // Assert
      expect(manager).toBeInstanceOf(NPMManager);
    });

    test("应该使用默认 EventBus 当没有注入时", () => {
      // Act
      const manager = new NPMManager();

      // Assert - 应该成功创建（不抛出错误）
      expect(manager).toBeInstanceOf(NPMManager);
    });
  });

  describe("installVersion", () => {
    test("应该成功发射安装事件并执行 npm install 命令", async () => {
      // Arrange
      const version = "1.7.9";
      const mockStdoutData = "Installing xiaozhi-client@1.7.9...\nSuccessfully installed";
      const mockStderrData = "";

      // 创建 mock spawn 进程
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === "data") {
              callback(mockStdoutData);
            }
          }),
        },
        stderr: {
          on: vi.fn((event, callback) => {
            if (event === "data") {
              callback(mockStderrData);
            }
          }),
        },
        on: vi.fn((event, callback) => {
          if (event === "close") {
            callback(0); // 成功退出码
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcess);

      // Act
      await npmManager.installVersion(version);

      // Assert
      expect(mockSpawn).toHaveBeenCalledWith("npm", [
        "install",
        "-g",
        "xiaozhi-client@1.7.9",
        "--registry=https://registry.npmmirror.com",
      ]);

      // 验证事件发射
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith("npm:install:started", {
        version: "1.7.9",
        installId: expect.stringMatching(/^install-\d+-[a-z0-9]+$/),
        timestamp: expect.any(Number),
      });

      expect(mockEventBus.emitEvent).toHaveBeenCalledWith("npm:install:log", {
        version: "1.7.9",
        installId: expect.stringMatching(/^install-\d+-[a-z0-9]+$/),
        type: "stdout",
        message: mockStdoutData,
        timestamp: expect.any(Number),
      });

      expect(mockEventBus.emitEvent).toHaveBeenCalledWith("npm:install:completed", {
        version: "1.7.9",
        installId: expect.stringMatching(/^install-\d+-[a-z0-9]+$/),
        success: true,
        duration: expect.any(Number),
        timestamp: expect.any(Number),
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringMatching(/^开始安装: xiaozhi-client@1\.7\.9 \[install-\d+-[a-z0-9]+\]$/)
      );
    });

    test("应该处理安装失败的情况", async () => {
      // Arrange
      const version = "1.7.9";
      const mockStdoutData = "Some output";
      const mockStderrData = "npm ERR! Installation failed";

      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === "data") {
              callback(mockStdoutData);
            }
          }),
        },
        stderr: {
          on: vi.fn((event, callback) => {
            if (event === "data") {
              callback(mockStderrData);
            }
          }),
        },
        on: vi.fn((event, callback) => {
          if (event === "close") {
            callback(1); // 失败退出码
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcess);

      // Act & Assert
      await expect(npmManager.installVersion(version)).rejects.toThrow(
        "安装失败，退出码: 1"
      );

      // 验证失败事件发射
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith("npm:install:failed", {
        version: "1.7.9",
        installId: expect.stringMatching(/^install-\d+-[a-z0-9]+$/),
        error: "安装失败，退出码: 1",
        duration: expect.any(Number),
        timestamp: expect.any(Number),
      });
    });

    test("应该处理 stderr 输出", async () => {
      // Arrange
      const version = "1.7.9";
      const mockStdoutData = "Installing...";
      const mockStderrData = "npm WARN deprecated package\nSome warning message";

      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === "data") {
              callback(mockStdoutData);
            }
          }),
        },
        stderr: {
          on: vi.fn((event, callback) => {
            if (event === "data") {
              callback(mockStderrData);
            }
          }),
        },
        on: vi.fn((event, callback) => {
          if (event === "close") {
            callback(0); // 成功退出码
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcess);

      // Act
      await npmManager.installVersion(version);

      // Assert - 验证 stderr 事件
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith("npm:install:log", {
        version: "1.7.9",
        installId: expect.stringMatching(/^install-\d+-[a-z0-9]+$/),
        type: "stderr",
        message: mockStderrData,
        timestamp: expect.any(Number),
      });
    });

    test("应该生成唯一的 installId", async () => {
      // Arrange
      const version = "1.7.9";
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === "close") callback(0);
        }),
      };
      mockSpawn.mockReturnValue(mockProcess);

      // Act
      await npmManager.installVersion(version);

      // Assert
      const startCall = mockEventBus.emitEvent.mock.calls.find(
        call => call[0] === "npm:install:started"
      );
      const installId = startCall?.[1]?.installId;

      expect(installId).toMatch(/^install-\d+-[a-z0-9]+$/);
      expect(typeof installId).toBe("string");
      expect(installId.length).toBeGreaterThan(10);
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

      const mockExecAsync = vi.fn();
      mockPromisify.mockReturnValue(mockExecAsync);
      mockExecAsync.mockReturnValue(Promise.resolve({ stdout: mockOutput }));

      // Act
      const result = await npmManager.getCurrentVersion();

      // Assert
      expect(result).toBe(expectedVersion);
      expect(mockExecAsync).toHaveBeenCalledWith(
        "npm list -g xiaozhi-client --depth=0 --json --registry=https://registry.npmmirror.com"
      );
    });

    test("应该处理包未安装的情况", async () => {
      // Arrange
      const mockOutput = JSON.stringify({
        dependencies: {},
      });

      const mockExecAsync = vi.fn();
      mockPromisify.mockReturnValue(mockExecAsync);
      mockExecAsync.mockReturnValue(Promise.resolve({ stdout: mockOutput }));

      // Act
      const result = await npmManager.getCurrentVersion();

      // Assert
      expect(result).toBe("unknown");
    });

    test("应该处理 npm list 输出中没有 dependencies 字段的情况", async () => {
      // Arrange
      const mockOutput = JSON.stringify({});

      const mockExecAsync = vi.fn();
      mockPromisify.mockReturnValue(mockExecAsync);
      mockExecAsync.mockReturnValue(Promise.resolve({ stdout: mockOutput }));

      // Act
      const result = await npmManager.getCurrentVersion();

      // Assert
      expect(result).toBe("unknown");
    });

    test("应该处理 npm list 命令失败的情况", async () => {
      // Arrange
      const listError = new Error("npm list failed");

      const mockExecAsync = vi.fn();
      mockPromisify.mockReturnValue(mockExecAsync);
      mockExecAsync.mockReturnValue(Promise.reject(listError));

      // Act & Assert
      await expect(npmManager.getCurrentVersion()).rejects.toThrow(listError);
    });

    test("应该处理无效的 JSON 输出", async () => {
      // Arrange
      const invalidJson = "{ invalid json }";

      const mockExecAsync = vi.fn();
      mockPromisify.mockReturnValue(mockExecAsync);
      mockExecAsync.mockReturnValue(Promise.resolve({ stdout: invalidJson }));

      // Act & Assert
      await expect(npmManager.getCurrentVersion()).rejects.toThrow();
    });
  });
});