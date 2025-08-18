import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Logger, logger } from "./logger.js";

// Mock dependencies
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
  statSync: vi.fn(),
  renameSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

vi.mock("node:path", () => ({
  join: vi.fn(),
  dirname: vi.fn(),
  basename: vi.fn(),
}));

vi.mock("chalk", () => ({
  default: {
    blue: vi.fn((text) => `blue(${text})`),
    green: vi.fn((text) => `green(${text})`),
    yellow: vi.fn((text) => `yellow(${text})`),
    red: vi.fn((text) => `red(${text})`),
    gray: vi.fn((text) => `gray(${text})`),
  },
}));

// Mock pino with proper structure
vi.mock("pino", () => {
  const mockDestination = vi.fn(() => ({
    write: vi.fn(),
    end: vi.fn(),
  }));

  const mockPinoInstance = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
  };

  const mockMultistream = vi.fn(() => mockPinoInstance);

  const mockPino = Object.assign(
    vi.fn(() => mockPinoInstance),
    {
      multistream: mockMultistream,
      destination: mockDestination,
      stdSerializers: {
        err: vi.fn((err) => ({ message: err.message, stack: err.stack })),
      },
      stdTimeFunctions: {
        isoTime: vi.fn(() => `,"time":"${new Date().toISOString()}"`),
      },
    }
  );

  return {
    default: mockPino,
  };
});

// Mock console.error to avoid actual output during tests
const originalConsoleError = console.error;
const mockConsoleError = vi.fn();

describe("Logger", async () => {
  const mockFs = vi.mocked(fs);
  const mockPath = vi.mocked(path);
  const pinoModule = await import("pino");
  const mockPino = vi.mocked(pinoModule.default);

  let mockDestination: any;
  let mockPinoInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock pino destination
    mockDestination = {
      write: vi.fn(),
      end: vi.fn(),
    };

    // Mock pino instance
    mockPinoInstance = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      fatal: vi.fn(),
    };

    // Setup pino mocks
    mockPino.mockReturnValue(mockPinoInstance);
    mockPino.multistream.mockReturnValue(mockPinoInstance);
    mockPino.destination.mockReturnValue(mockDestination);

    // Setup fs mocks
    mockPath.join.mockImplementation((...args) => args.join("/"));
    mockPath.dirname.mockImplementation((p) =>
      p.split("/").slice(0, -1).join("/")
    );
    mockPath.basename.mockImplementation((p, ext) => {
      const name = p.split("/").pop() || "";
      return ext ? name.replace(ext, "") : name;
    });

    // Mock console.error
    console.error = mockConsoleError;

    // Reset environment
    process.env.XIAOZHI_DAEMON = undefined;
  });

  afterEach(() => {
    vi.clearAllMocks();
    console.error = originalConsoleError;
  });

  describe("constructor", () => {
    it("should create logger instance with default settings", () => {
      const testLogger = new Logger();

      expect(mockPino).toHaveBeenCalled();
      expect(testLogger).toBeInstanceOf(Logger);
    });

    it("should detect daemon mode from environment", () => {
      process.env.XIAOZHI_DAEMON = "true";
      const testLogger = new Logger();

      expect(mockPino).toHaveBeenCalled();
      expect(testLogger).toBeInstanceOf(Logger);
    });

    it("should detect non-daemon mode", () => {
      process.env.XIAOZHI_DAEMON = "false";
      const testLogger = new Logger();

      expect(mockPino).toHaveBeenCalled();
      expect(testLogger).toBeInstanceOf(Logger);
    });
  });

  describe("initLogFile", () => {
    it("should initialize log file when it does not exist", () => {
      const testLogger = new Logger();
      mockFs.existsSync.mockReturnValue(false);

      testLogger.initLogFile("/test/project");

      expect(mockPath.join).toHaveBeenCalledWith(
        "/test/project",
        "xiaozhi.log"
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        "/test/project/xiaozhi.log",
        ""
      );
      // 验证 pino 实例被重新创建
      expect(mockPino).toHaveBeenCalledTimes(2); // 一次构造函数，一次 initLogFile
    });

    it("should initialize log file when it already exists", () => {
      const testLogger = new Logger();
      mockFs.existsSync.mockReturnValue(true);

      testLogger.initLogFile("/test/project");

      expect(mockFs.writeFileSync).not.toHaveBeenCalled();
      // 验证 pino 实例被重新创建
      expect(mockPino).toHaveBeenCalledTimes(2); // 一次构造函数，一次 initLogFile
    });
  });

  describe("file logging", () => {
    it("should automatically enable file logging when log file is initialized", () => {
      const testLogger = new Logger();

      testLogger.initLogFile("/test/project");

      // 验证 pino.destination 被调用来创建文件流
      expect(mockPino.destination).toHaveBeenCalledWith({
        dest: "/test/project/xiaozhi.log",
        sync: false,
        append: true,
        mkdir: true,
      });
    });

    it("should not create file stream when no log file path is set", () => {
      const testLogger = new Logger();

      // 只应该创建控制台流，不创建文件流
      expect(mockPino.destination).not.toHaveBeenCalled();
    });

    it("should handle file logging in daemon mode", () => {
      process.env.XIAOZHI_DAEMON = "true";
      const testLogger = new Logger();
      testLogger.initLogFile("/test/project");

      // 在守护进程模式下，应该只有文件流，没有控制台流
      expect(mockPino.multistream).toHaveBeenCalled();
      expect(mockPino.destination).toHaveBeenCalled();
    });

    it("should handle close method", () => {
      const testLogger = new Logger();

      // close 方法应该存在且不抛出错误
      expect(() => testLogger.close()).not.toThrow();
    });
  });

  describe("logging methods", () => {
    let testLogger: Logger;

    beforeEach(() => {
      testLogger = new Logger();
      testLogger.initLogFile("/test/project");
    });

    it("should log info messages", () => {
      testLogger.info("Test info message", "arg1", "arg2");

      expect(mockPinoInstance.info).toHaveBeenCalledWith(
        { args: ["arg1", "arg2"] },
        "Test info message"
      );
    });

    it("should log info messages with structured data", () => {
      testLogger.info({ userId: 123, action: "test" }, "User action");

      expect(mockPinoInstance.info).toHaveBeenCalledWith(
        { userId: 123, action: "test" },
        "User action"
      );
    });

    it("should log info messages without arguments", () => {
      testLogger.info("Simple message");

      expect(mockPinoInstance.info).toHaveBeenCalledWith("Simple message");
    });

    it("should log success messages (mapped to info)", () => {
      testLogger.success("Test success message");

      expect(mockPinoInstance.info).toHaveBeenCalledWith(
        "Test success message"
      );
    });

    it("should log warning messages", () => {
      testLogger.warn("Test warning message");

      expect(mockPinoInstance.warn).toHaveBeenCalledWith(
        "Test warning message"
      );
    });

    it("should log error messages", () => {
      testLogger.error("Test error message");

      expect(mockPinoInstance.error).toHaveBeenCalledWith("Test error message");
    });

    it("should log error messages with Error objects", () => {
      const error = new Error("Test error");
      testLogger.error("Operation failed", error);

      expect(mockPinoInstance.error).toHaveBeenCalledWith(
        {
          args: [
            {
              message: "Test error",
              stack: error.stack,
              name: "Error",
              cause: undefined,
            },
          ],
        },
        "Operation failed"
      );
    });

    it("should log debug messages", () => {
      testLogger.debug("Test debug message");

      expect(mockPinoInstance.debug).toHaveBeenCalledWith("Test debug message");
    });

    it("should log general messages (mapped to info)", () => {
      testLogger.log("Test log message");

      expect(mockPinoInstance.info).toHaveBeenCalledWith("Test log message");
    });
  });

  describe("withTag", () => {
    it("should return the same instance (deprecated functionality)", () => {
      const testLogger = new Logger();
      const taggedLogger = testLogger.withTag("TEST_TAG");

      expect(taggedLogger).toBe(testLogger);
    });
  });

  describe("close", () => {
    it("should handle close gracefully", () => {
      const testLogger = new Logger();
      testLogger.initLogFile("/test/project");

      // Should not throw error
      expect(() => testLogger.close()).not.toThrow();
    });

    it("should handle close when no log file exists", () => {
      const testLogger = new Logger();

      // Should not throw error
      expect(() => testLogger.close()).not.toThrow();
    });
  });

  describe("singleton instance", () => {
    it("should export a singleton logger instance", () => {
      expect(logger).toBeInstanceOf(Logger);
    });
  });

  describe("file management", () => {
    let testLogger: Logger;

    beforeEach(() => {
      testLogger = new Logger();
    });

    it("should set log file options", () => {
      testLogger.setLogFileOptions(5 * 1024 * 1024, 10);

      // Should not throw error
      expect(() => testLogger.setLogFileOptions(1024, 3)).not.toThrow();
    });

    it("should clean up old logs", () => {
      testLogger.initLogFile("/test/project");

      // Should not throw error
      expect(() => testLogger.cleanupOldLogs()).not.toThrow();
    });

    it("should handle log rotation", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 20 * 1024 * 1024 }); // 20MB file

      testLogger.initLogFile("/test/project");

      // Should not throw error during rotation
      expect(() => testLogger.initLogFile("/test/project")).not.toThrow();
    });
  });

  describe("utility functions", () => {
    it("should handle safe write operations", () => {
      const testLogger = new Logger();

      // Test that logging works even in edge cases
      expect(() => testLogger.info("Test message")).not.toThrow();
      expect(() => testLogger.error("Test error")).not.toThrow();
    });

    it("should enhance error objects", () => {
      const testLogger = new Logger();
      const error = new Error("Test error");
      error.cause = new Error("Root cause");

      testLogger.error({ operation: "test", error }, "Operation failed");

      expect(mockPinoInstance.error).toHaveBeenCalled();
    });
  });
});
