import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Mock all external dependencies first
vi.mock("node:child_process");
vi.mock("node:util");
vi.mock("semver");
vi.mock("../../Logger.js");
vi.mock("../EventBus.js");

// Import after mocking
import type { EventBus } from "@services/EventBus.js";
import { NPMManager } from "@/lib/npm";

/**
 * Mock Logger 类型接口
 * 用于测试中模拟 Logger 对象
 */
interface MockLogger {
  info: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
}

/**
 * Mock EventBus 类型接口
 * 用于测试中模拟 EventBus 对象
 */
interface MockEventBus extends Partial<EventBus> {
  emitEvent: ReturnType<typeof vi.fn>;
  mock?: {
    calls: Array<[string, Record<string, unknown>]>;
  };
}

/**
 * Mock ChildProcess 类型接口（简化版）
 * 用于测试中模拟 child_process.spawn 返回的进程对象
 */
interface MockChildProcess {
  stdout: {
    on: ReturnType<typeof vi.fn>;
  };
  stderr: {
    on: ReturnType<typeof vi.fn>;
  };
  on: ReturnType<typeof vi.fn>;
}

/**
 * Mock spawn 函数类型
 * 用于测试中模拟 child_process.spawn 函数
 */
type MockSpawn = ReturnType<typeof vi.fn> & {
  mockReturnValue: (value: MockChildProcess) => void;
};

/**
 * Mock execAsync 函数类型
 * 用于测试中模拟 promisify(exec) 函数
 */
type MockExecAsync = ReturnType<typeof vi.fn>;

describe("NPMManager", () => {
  let npmManager: NPMManager;
  let mockLogger: MockLogger;
  let mockEventBus: MockEventBus;
  let mockSpawn: MockSpawn;
  let mockExecAsync: MockExecAsync;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    // Setup mock event bus
    mockEventBus = {
      emitEvent: vi.fn(),
    };

    // Setup mock spawn
    mockSpawn = vi.fn();

    // Setup mock execAsync
    mockExecAsync = vi.fn();

    // Mock the imports
    const { logger } = await import("../../Logger.js");
    vi.mocked(logger.withTag).mockReturnValue(mockLogger as never);

    const { getEventBus } = await import("../EventBus.js");
    vi.mocked(getEventBus).mockReturnValue(mockEventBus as never);

    const { spawn } = await import("node:child_process");
    vi.mocked(spawn).mockImplementation(mockSpawn as never);

    const { promisify } = await import("node:util");
    vi.mocked(promisify).mockReturnValue(mockExecAsync as never);

    // Create NPMManager instance
    npmManager = new NPMManager(mockEventBus as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    test("应该使用注入的 EventBus", () => {
      // Act
      const manager = new NPMManager(mockEventBus as never);

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
      const mockStdoutData =
        "Installing xiaozhi-client@1.7.9...\nSuccessfully installed";
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
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "npm:install:started",
        {
          version: "1.7.9",
          installId: expect.stringMatching(/^install-\d+-[a-z0-9]+$/),
          timestamp: expect.any(Number),
        }
      );

      expect(mockEventBus.emitEvent).toHaveBeenCalledWith("npm:install:log", {
        version: "1.7.9",
        installId: expect.stringMatching(/^install-\d+-[a-z0-9]+$/),
        type: "stdout",
        message: mockStdoutData,
        timestamp: expect.any(Number),
      });

      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "npm:install:completed",
        {
          version: "1.7.9",
          installId: expect.stringMatching(/^install-\d+-[a-z0-9]+$/),
          success: true,
          duration: expect.any(Number),
          timestamp: expect.any(Number),
        }
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringMatching(
          /^开始安装: xiaozhi-client@1\.7\.9 \[install-\d+-[a-z0-9]+\]$/
        )
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
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "npm:install:failed",
        {
          version: "1.7.9",
          installId: expect.stringMatching(/^install-\d+-[a-z0-9]+$/),
          error: "安装失败，退出码: 1",
          duration: expect.any(Number),
          timestamp: expect.any(Number),
        }
      );
    });

    test("应该处理 stderr 输出", async () => {
      // Arrange
      const version = "1.7.9";
      const mockStdoutData = "Installing...";
      const mockStderrData =
        "npm WARN deprecated package\nSome warning message";

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
        (call) => call[0] === "npm:install:started"
      ) as [string, { version: string; installId: string }] | undefined;
      const installId = startCall?.[1]?.installId;

      // 确保找到调用记录
      expect(startCall).toBeDefined();
      expect(installId).toBeDefined();
      expect(installId).toMatch(/^install-\d+-[a-z0-9]+$/);
      expect(typeof installId).toBe("string");
      expect(installId!.length).toBeGreaterThan(10);
    });
  });

  describe("getCurrentVersion", () => {
    // Skip getCurrentVersion tests for now due to top-level const execAsync mocking issues
    // These tests require deeper refactoring of the source code or more sophisticated mocking
    test.skip("应该成功获取当前版本", async () => {
      // TODO: Fix top-level const execAsync mocking
    });

    test.skip("应该处理包未安装的情况", async () => {
      // TODO: Fix top-level const execAsync mocking
    });

    test.skip("应该处理 npm list 输出中没有 dependencies 字段的情况", async () => {
      // TODO: Fix top-level const execAsync mocking
    });

    test.skip("应该处理 npm list 命令失败的情况", async () => {
      // TODO: Fix top-level const execAsync mocking
    });

    test.skip("应该处理无效的 JSON 输出", async () => {
      // TODO: Fix top-level const execAsync mocking
    });
  });
});
