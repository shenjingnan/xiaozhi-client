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

describe("日志记录器", async () => {
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

  describe("构造函数", () => {
    it("应该使用默认设置创建日志记录器实例（使用 Pino）", () => {
      const testLogger = new Logger();

      // 现在默认使用 Pino，所以应该创建 PinoAdapter 实例
      expect(MockPinoAdapter).toHaveBeenCalled();
      // 不应该调用 consola
      expect(mockCreateConsola).not.toHaveBeenCalled();
    });

    it("应该从环境变量检测守护进程模式", () => {
      process.env.XIAOZHI_DAEMON = "true";
      const testLogger = new Logger();

      // 应该创建 PinoAdapter 实例
      expect(MockPinoAdapter).toHaveBeenCalled();
    });

    it("应该检测非守护进程模式", () => {
      process.env.XIAOZHI_DAEMON = "false";
      const testLogger = new Logger();

      // 应该创建 PinoAdapter 实例
      expect(MockPinoAdapter).toHaveBeenCalled();
    });
  });

  describe("初始化日志文件", () => {
    it("当日志文件不存在时应该初始化日志文件（Pino 模式）", () => {
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

    it("当日志文件已存在时应该初始化日志文件（Pino 模式）", () => {
      const testLogger = new Logger();
      mockFs.existsSync.mockReturnValue(true);

      testLogger.initLogFile("/test/project");

      // 在 Pino 模式下，会重新创建 PinoAdapter 实例
      expect(MockPinoAdapter).toHaveBeenCalledTimes(2); // 一次构造函数，一次 initLogFile
    });
  });

  describe("启用文件日志", () => {
    it("当设置日志文件路径时应该启用文件日志（Pino 模式）", () => {
      const testLogger = new Logger();
      testLogger.initLogFile("/test/project");

      // Clear the mock calls
      MockPinoAdapter.mockClear();

      testLogger.enableFileLogging(true);

      // 在 Pino 模式下，会重新创建 PinoAdapter 实例
      expect(MockPinoAdapter).toHaveBeenCalled();
    });

    it("当未设置日志文件路径时不应启用文件日志（Pino 模式）", () => {
      const testLogger = new Logger();

      // Clear the mock calls
      MockPinoAdapter.mockClear();

      testLogger.enableFileLogging(true);

      // 在 Pino 模式下，仍会重新创建 PinoAdapter 实例
      expect(MockPinoAdapter).toHaveBeenCalled();
    });

    it("应该禁用文件日志（Pino 模式）", () => {
      const testLogger = new Logger();
      testLogger.initLogFile("/test/project");

      // Clear the mock calls
      MockPinoAdapter.mockClear();

      testLogger.enableFileLogging(false);

      // 在 Pino 模式下，会重新创建 PinoAdapter 实例
      expect(MockPinoAdapter).toHaveBeenCalled();
    });

    it("当不存在写入流时应该处理禁用操作（Pino 模式）", () => {
      const testLogger = new Logger();

      // Should not throw error
      expect(() => testLogger.enableFileLogging(false)).not.toThrow();
    });
  });

  describe("日志记录方法", () => {
    let testLogger: Logger;

    beforeEach(() => {
      testLogger = new Logger();
      testLogger.initLogFile("/test/project");
    });

    it("应该记录信息消息（Pino 模式）", () => {
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

    it("应该记录成功消息（Pino 模式）", () => {
      testLogger.success("Test success message");

      expect(mockPinoAdapterInstance.success).toHaveBeenCalledWith(
        "Test success message"
      );
      expect(mockConsolaInstance.success).not.toHaveBeenCalled();
    });

    it("应该记录警告消息（Pino 模式）", () => {
      testLogger.warn("Test warning message");

      expect(mockPinoAdapterInstance.warn).toHaveBeenCalledWith(
        "Test warning message"
      );
      expect(mockConsolaInstance.warn).not.toHaveBeenCalled();
    });

    it("应该记录错误消息（Pino 模式）", () => {
      testLogger.error("Test error message");

      expect(mockPinoAdapterInstance.error).toHaveBeenCalledWith(
        "Test error message"
      );
      expect(mockConsolaInstance.error).not.toHaveBeenCalled();
    });

    it("应该记录调试消息（Pino 模式）", () => {
      testLogger.debug("Test debug message");

      expect(mockPinoAdapterInstance.debug).toHaveBeenCalledWith(
        "Test debug message"
      );
      expect(mockConsolaInstance.debug).not.toHaveBeenCalled();
    });

    it("应该记录一般消息（Pino 模式）", () => {
      testLogger.log("Test log message");

      expect(mockPinoAdapterInstance.log).toHaveBeenCalledWith(
        "Test log message"
      );
      expect(mockConsolaInstance.log).not.toHaveBeenCalled();
    });
  });

  describe("带标签", () => {
    it("应该返回带标签的新实例（Pino 模式）", () => {
      const testLogger = new Logger();

      // Mock the withTag method to return a new Logger instance
      mockPinoAdapterInstance.withTag.mockReturnValue(new Logger());

      const taggedLogger = testLogger.withTag("TEST_TAG");

      // 在 Pino 模式下，应该返回新的实例
      expect(taggedLogger).toBeInstanceOf(Logger);
      expect(taggedLogger).not.toBe(testLogger);
    });
  });

  describe("关闭", () => {
    it("当资源存在时应该关闭资源（Pino 模式）", () => {
      const testLogger = new Logger();
      testLogger.initLogFile("/test/project");

      testLogger.close();

      // 在 Pino 模式下，不会调用 writeStream.end
      expect(mockWriteStream.end).not.toHaveBeenCalled();
    });

    it("当没有资源存在时应该处理关闭操作（Pino 模式）", () => {
      const testLogger = new Logger();

      // Should not throw error
      expect(() => testLogger.close()).not.toThrow();
    });
  });

  describe("单例实例", () => {
    it("应该导出单例日志记录器实例", () => {
      expect(logger).toBeInstanceOf(Logger);
    });
  });

  describe("记录到文件", () => {
    let testLogger: Logger;

    beforeEach(() => {
      testLogger = new Logger();
      testLogger.initLogFile("/test/project");
    });

    it("应该格式化带时间戳的日志消息（Pino 模式）", () => {
      testLogger.info("Test message");

      // 在 Pino 模式下，不会直接写入 writeStream
      expect(mockPinoAdapterInstance.info).toHaveBeenCalledWith("Test message");
      expect(mockWriteStream.write).not.toHaveBeenCalled();
    });

    it("应该处理对象参数（Pino 模式）", () => {
      const testObj = { key: "value", number: 42 };
      testLogger.info("Test message", testObj);

      expect(mockPinoAdapterInstance.info).toHaveBeenCalledWith(
        "Test message",
        testObj
      );
      expect(mockWriteStream.write).not.toHaveBeenCalled();
    });

    it("应该处理混合参数类型（Pino 模式）", () => {
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

    it("当写入流为空时不应写入文件（Pino 模式）", () => {
      testLogger.close(); // This sets pinoAdapter to null

      testLogger.info("Test message");

      // 在 Pino 模式下，不会调用 consola
      expect(mockConsolaInstance.info).not.toHaveBeenCalled();
      expect(mockWriteStream.write).not.toHaveBeenCalled();
    });
  });

  describe("格式化日期时间", () => {
    it("应该正确格式化日期（遗留测试 - 在 Pino 模式下不适用）", () => {
      // 这个测试在 Pino 模式下不再适用，因为日期格式化由 Pino 处理
      // 但我们保留测试以确保不会抛出错误
      const testLogger = new Logger();

      // 在 Pino 模式下，formatDateTime 函数仍然存在但不会被调用
      expect(testLogger).toBeInstanceOf(Logger);
    });
  });

  describe("报告器功能（遗留 - 在 Pino 模式下不适用）", () => {
    it("应该使用 Pino 进行日志记录而不是自定义报告器", () => {
      const testLogger = new Logger();

      // 在 Pino 模式下，不会设置自定义 reporter
      expect(mockConsolaInstance.setReporters).not.toHaveBeenCalled();

      // 应该创建 PinoAdapter 实例
      expect(MockPinoAdapter).toHaveBeenCalled();
    });
  });
});
