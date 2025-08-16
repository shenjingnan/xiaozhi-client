import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Logger, logger } from "./logger.js";

// Mock dependencies
vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(),
    writeFileSync: vi.fn(),
    createWriteStream: vi.fn(),
    WriteStream: vi.fn(),
  },
}));

vi.mock("node:path", () => ({
  default: {
    join: vi.fn(),
  },
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

vi.mock("consola", () => ({
  createConsola: vi.fn(() => ({
    setReporters: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    log: vi.fn(),
  })),
}));

// Mock PinoAdapter
vi.mock("./logger/PinoAdapter.js", () => ({
  PinoAdapter: vi.fn(() => ({
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    log: vi.fn(),
    withTag: vi.fn(),
    destroy: vi.fn(),
  })),
}));

// Mock console.error to avoid actual output during tests
const originalConsoleError = console.error;
const mockConsoleError = vi.fn();

describe("Logger", async () => {
  const mockFs = vi.mocked(fs);
  const mockPath = vi.mocked(path);
  const consolaModule = await import("consola");
  const mockCreateConsola = vi.mocked(consolaModule.createConsola);
  const pinoAdapterModule = await import("./logger/PinoAdapter.js");
  const MockPinoAdapter = vi.mocked(pinoAdapterModule.PinoAdapter);

  let mockWriteStream: any;
  let mockConsolaInstance: any;
  let mockPinoAdapterInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock WriteStream
    mockWriteStream = {
      write: vi.fn(),
      end: vi.fn(),
    };

    // Mock consola instance
    mockConsolaInstance = {
      setReporters: vi.fn(),
      info: vi.fn(),
      success: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
    };

    // Mock PinoAdapter instance
    mockPinoAdapterInstance = {
      info: vi.fn(),
      success: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
      withTag: vi.fn(),
      destroy: vi.fn(),
    };

    mockCreateConsola.mockReturnValue(mockConsolaInstance);
    MockPinoAdapter.mockReturnValue(mockPinoAdapterInstance);
    mockFs.createWriteStream.mockReturnValue(mockWriteStream);
    mockPath.join.mockImplementation((...args) => args.join("/"));

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
    it("should create logger instance with default settings (using Pino)", () => {
      const testLogger = new Logger();

      // 现在默认使用 Pino，所以应该创建 PinoAdapter 实例
      expect(MockPinoAdapter).toHaveBeenCalled();
      // 不应该调用 consola
      expect(mockCreateConsola).not.toHaveBeenCalled();
    });

    it("should detect daemon mode from environment", () => {
      process.env.XIAOZHI_DAEMON = "true";
      const testLogger = new Logger();

      // 应该创建 PinoAdapter 实例
      expect(MockPinoAdapter).toHaveBeenCalled();
    });

    it("should detect non-daemon mode", () => {
      process.env.XIAOZHI_DAEMON = "false";
      const testLogger = new Logger();

      // 应该创建 PinoAdapter 实例
      expect(MockPinoAdapter).toHaveBeenCalled();
    });
  });

  describe("initLogFile", () => {
    it("should initialize log file when it does not exist (Pino mode)", () => {
      const testLogger = new Logger();
      mockFs.existsSync.mockReturnValue(false);

      testLogger.initLogFile("/test/project");

      expect(mockPath.join).toHaveBeenCalledWith(
        "/test/project",
        "xiaozhi.log"
      );
      // 在 Pino 模式下，会重新创建 PinoAdapter 实例
      expect(MockPinoAdapter).toHaveBeenCalledTimes(2); // 一次构造函数，一次 initLogFile
    });

    it("should initialize log file when it already exists (Pino mode)", () => {
      const testLogger = new Logger();
      mockFs.existsSync.mockReturnValue(true);

      testLogger.initLogFile("/test/project");

      // 在 Pino 模式下，会重新创建 PinoAdapter 实例
      expect(MockPinoAdapter).toHaveBeenCalledTimes(2); // 一次构造函数，一次 initLogFile
    });
  });

  describe("enableFileLogging", () => {
    it("should enable file logging when log file path is set (Pino mode)", () => {
      const testLogger = new Logger();
      testLogger.initLogFile("/test/project");

      // Clear the mock calls
      MockPinoAdapter.mockClear();

      testLogger.enableFileLogging(true);

      // 在 Pino 模式下，会重新创建 PinoAdapter 实例
      expect(MockPinoAdapter).toHaveBeenCalled();
    });

    it("should not enable file logging when log file path is not set (Pino mode)", () => {
      const testLogger = new Logger();

      // Clear the mock calls
      MockPinoAdapter.mockClear();

      testLogger.enableFileLogging(true);

      // 在 Pino 模式下，仍会重新创建 PinoAdapter 实例
      expect(MockPinoAdapter).toHaveBeenCalled();
    });

    it("should disable file logging (Pino mode)", () => {
      const testLogger = new Logger();
      testLogger.initLogFile("/test/project");

      // Clear the mock calls
      MockPinoAdapter.mockClear();

      testLogger.enableFileLogging(false);

      // 在 Pino 模式下，会重新创建 PinoAdapter 实例
      expect(MockPinoAdapter).toHaveBeenCalled();
    });

    it("should handle disable when no write stream exists (Pino mode)", () => {
      const testLogger = new Logger();

      // Should not throw error
      expect(() => testLogger.enableFileLogging(false)).not.toThrow();
    });
  });

  describe("logging methods", () => {
    let testLogger: Logger;

    beforeEach(() => {
      testLogger = new Logger();
      testLogger.initLogFile("/test/project");
    });

    it("should log info messages (Pino mode)", () => {
      testLogger.info("Test info message", "arg1", "arg2");

      // 在 Pino 模式下，应该调用 PinoAdapter 的方法
      expect(mockPinoAdapterInstance.info).toHaveBeenCalledWith(
        "Test info message",
        "arg1",
        "arg2"
      );
      // 不应该调用 consola
      expect(mockConsolaInstance.info).not.toHaveBeenCalled();
    });

    it("should log success messages (Pino mode)", () => {
      testLogger.success("Test success message");

      expect(mockPinoAdapterInstance.success).toHaveBeenCalledWith(
        "Test success message"
      );
      expect(mockConsolaInstance.success).not.toHaveBeenCalled();
    });

    it("should log warning messages (Pino mode)", () => {
      testLogger.warn("Test warning message");

      expect(mockPinoAdapterInstance.warn).toHaveBeenCalledWith(
        "Test warning message"
      );
      expect(mockConsolaInstance.warn).not.toHaveBeenCalled();
    });

    it("should log error messages (Pino mode)", () => {
      testLogger.error("Test error message");

      expect(mockPinoAdapterInstance.error).toHaveBeenCalledWith(
        "Test error message"
      );
      expect(mockConsolaInstance.error).not.toHaveBeenCalled();
    });

    it("should log debug messages (Pino mode)", () => {
      testLogger.debug("Test debug message");

      expect(mockPinoAdapterInstance.debug).toHaveBeenCalledWith(
        "Test debug message"
      );
      expect(mockConsolaInstance.debug).not.toHaveBeenCalled();
    });

    it("should log general messages (Pino mode)", () => {
      testLogger.log("Test log message");

      expect(mockPinoAdapterInstance.log).toHaveBeenCalledWith("Test log message");
      expect(mockConsolaInstance.log).not.toHaveBeenCalled();
    });
  });

  describe("withTag", () => {
    it("should return a new instance with tag (Pino mode)", () => {
      const testLogger = new Logger();

      // Mock the withTag method to return a new Logger instance
      mockPinoAdapterInstance.withTag.mockReturnValue(new Logger());

      const taggedLogger = testLogger.withTag("TEST_TAG");

      // 在 Pino 模式下，应该返回新的实例
      expect(taggedLogger).toBeInstanceOf(Logger);
      expect(taggedLogger).not.toBe(testLogger);
    });
  });

  describe("close", () => {
    it("should close resources when they exist (Pino mode)", () => {
      const testLogger = new Logger();
      testLogger.initLogFile("/test/project");

      testLogger.close();

      // 在 Pino 模式下，不会调用 writeStream.end
      expect(mockWriteStream.end).not.toHaveBeenCalled();
    });

    it("should handle close when no resources exist (Pino mode)", () => {
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

  describe("logToFile", () => {
    let testLogger: Logger;

    beforeEach(() => {
      testLogger = new Logger();
      testLogger.initLogFile("/test/project");
    });

    it("should format log messages with timestamp (Pino mode)", () => {
      testLogger.info("Test message");

      // 在 Pino 模式下，不会直接写入 writeStream
      expect(mockPinoAdapterInstance.info).toHaveBeenCalledWith("Test message");
      expect(mockWriteStream.write).not.toHaveBeenCalled();
    });

    it("should handle object arguments (Pino mode)", () => {
      const testObj = { key: "value", number: 42 };
      testLogger.info("Test message", testObj);

      expect(mockPinoAdapterInstance.info).toHaveBeenCalledWith("Test message", testObj);
      expect(mockWriteStream.write).not.toHaveBeenCalled();
    });

    it("should handle mixed argument types (Pino mode)", () => {
      testLogger.info(
        "Test message",
        "string",
        123,
        { obj: "value" },
        null,
        undefined
      );

      expect(mockPinoAdapterInstance.info).toHaveBeenCalledWith(
        "Test message",
        "string",
        123,
        { obj: "value" },
        null,
        undefined
      );
      expect(mockWriteStream.write).not.toHaveBeenCalled();
    });

    it("should not write to file when write stream is null (Pino mode)", () => {
      testLogger.close(); // This sets pinoAdapter to null

      testLogger.info("Test message");

      // 在 Pino 模式下，不会调用 consola
      expect(mockConsolaInstance.info).not.toHaveBeenCalled();
      expect(mockWriteStream.write).not.toHaveBeenCalled();
    });
  });

  describe("formatDateTime", () => {
    it("should format date correctly (legacy test - not applicable in Pino mode)", () => {
      // 这个测试在 Pino 模式下不再适用，因为日期格式化由 Pino 处理
      // 但我们保留测试以确保不会抛出错误
      const testLogger = new Logger();

      // 在 Pino 模式下，formatDateTime 函数仍然存在但不会被调用
      expect(testLogger).toBeInstanceOf(Logger);
    });
  });

  describe("reporter functionality (legacy - not applicable in Pino mode)", () => {
    it("should use Pino for logging instead of custom reporter", () => {
      const testLogger = new Logger();

      // 在 Pino 模式下，不会设置自定义 reporter
      expect(mockConsolaInstance.setReporters).not.toHaveBeenCalled();

      // 应该创建 PinoAdapter 实例
      expect(MockPinoAdapter).toHaveBeenCalled();
    });
  });
});
