import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Logger, logger } from "../Logger.js";

// 模拟依赖
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

// 使用正确结构模拟 pino
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

// 模拟 console.error 以避免测试期间的实际输出
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

    // 模拟 pino destination
    mockDestination = {
      write: vi.fn(),
      end: vi.fn(),
    };

    // 模拟 pino 实例
    mockPinoInstance = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      fatal: vi.fn(),
    };

    // 设置 pino 模拟
    mockPino.mockReturnValue(mockPinoInstance);
    (mockPino as any).multistream = vi.fn().mockReturnValue(mockPinoInstance);
    (mockPino as any).destination = vi.fn().mockReturnValue(mockDestination);

    // 设置 fs 模拟
    mockPath.join.mockImplementation((...args) => args.join("/"));
    mockPath.dirname.mockImplementation((p) =>
      p.split("/").slice(0, -1).join("/")
    );
    mockPath.basename.mockImplementation((p, ext) => {
      const name = p.split("/").pop() || "";
      return ext ? name.replace(ext, "") : name;
    });

    // 模拟 console.error
    console.error = mockConsoleError;

    // 重置环境
    process.env.XIAOZHI_DAEMON = undefined;
  });

  afterEach(() => {
    vi.clearAllMocks();
    console.error = originalConsoleError;
  });

  describe("constructor", () => {
    it("应该创建 logger 实例（默认设置）", () => {
      const testLogger = new Logger();

      expect(mockPino).toHaveBeenCalled();
      expect(testLogger).toBeInstanceOf(Logger);
    });

    it("应该从环境变量检测守护进程模式", () => {
      process.env.XIAOZHI_DAEMON = "true";
      const testLogger = new Logger();

      expect(mockPino).toHaveBeenCalled();
      expect(testLogger).toBeInstanceOf(Logger);
    });

    it("应该检测非守护进程模式", () => {
      process.env.XIAOZHI_DAEMON = "false";
      const testLogger = new Logger();

      expect(mockPino).toHaveBeenCalled();
      expect(testLogger).toBeInstanceOf(Logger);
    });
  });

  describe("initLogFile", () => {
    it("应该在日志文件不存在时初始化", () => {
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

    it("应该在日志文件已存在时初始化", () => {
      const testLogger = new Logger();
      mockFs.existsSync.mockReturnValue(true);

      testLogger.initLogFile("/test/project");

      expect(mockFs.writeFileSync).not.toHaveBeenCalled();
      // 验证 pino 实例被重新创建
      expect(mockPino).toHaveBeenCalledTimes(2); // 一次构造函数，一次 initLogFile
    });
  });

  describe("文件日志记录", () => {
    it("应该在初始化日志文件时自动启用文件日志记录", () => {
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

    it("应该在没有设置日志文件路径时不创建文件流", () => {
      const _testLogger = new Logger();

      // 只应该创建控制台流，不创建文件流
      expect(mockPino.destination).not.toHaveBeenCalled();
    });

    it("应该在守护进程模式下处理文件日志记录", () => {
      process.env.XIAOZHI_DAEMON = "true";
      const testLogger = new Logger();
      testLogger.initLogFile("/test/project");

      // 在守护进程模式下，应该只有文件流，没有控制台流
      expect(mockPino.multistream).toHaveBeenCalled();
      expect(mockPino.destination).toHaveBeenCalled();
    });

    it("应该处理 close 方法", () => {
      const testLogger = new Logger();

      // close 方法应该存在且不抛出错误
      expect(() => testLogger.close()).not.toThrow();
    });
  });

  describe("日志记录方法", () => {
    let testLogger: Logger;

    beforeEach(() => {
      testLogger = new Logger();
      testLogger.initLogFile("/test/project");
    });

    it("应该记录 info 消息", () => {
      testLogger.info("Test info message", "arg1", "arg2");

      expect(mockPinoInstance.info).toHaveBeenCalledWith(
        { args: ["arg1", "arg2"] },
        "Test info message"
      );
    });

    it("应该记录带结构化数据的 info 消息", () => {
      testLogger.info({ userId: 123, action: "test" }, "User action");

      expect(mockPinoInstance.info).toHaveBeenCalledWith(
        { userId: 123, action: "test" },
        "User action"
      );
    });

    it("应该记录不带参数的 info 消息", () => {
      testLogger.info("Simple message");

      expect(mockPinoInstance.info).toHaveBeenCalledWith("Simple message");
    });

    it("应该记录 success 消息（映射到 info）", () => {
      testLogger.success("Test success message");

      expect(mockPinoInstance.info).toHaveBeenCalledWith(
        "Test success message"
      );
    });

    it("应该记录 warning 消息", () => {
      testLogger.warn("Test warning message");

      expect(mockPinoInstance.warn).toHaveBeenCalledWith(
        "Test warning message"
      );
    });

    it("应该记录 error 消息", () => {
      testLogger.error("Test error message");

      expect(mockPinoInstance.error).toHaveBeenCalledWith("Test error message");
    });

    it("应该记录带 Error 对象的 error 消息", () => {
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

    it("应该记录 debug 消息", () => {
      testLogger.debug("Test debug message");

      expect(mockPinoInstance.debug).toHaveBeenCalledWith("Test debug message");
    });

    it("应该记录常规消息（映射到 info）", () => {
      testLogger.log("Test log message");

      expect(mockPinoInstance.info).toHaveBeenCalledWith("Test log message");
    });
  });

  describe("close", () => {
    it("应该优雅地处理 close", () => {
      const testLogger = new Logger();
      testLogger.initLogFile("/test/project");

      // 不应该抛出错误
      expect(() => testLogger.close()).not.toThrow();
    });

    it("应该在日志文件不存在时处理 close", () => {
      const testLogger = new Logger();

      // 不应该抛出错误
      expect(() => testLogger.close()).not.toThrow();
    });
  });

  describe("单例实例", () => {
    it("应该导出单例 logger 实例", () => {
      expect(logger).toBeInstanceOf(Logger);
    });
  });

  describe("文件管理", () => {
    let testLogger: Logger;

    beforeEach(() => {
      testLogger = new Logger();
    });

    it("应该设置日志文件选项", () => {
      testLogger.setLogFileOptions(5 * 1024 * 1024, 10);

      // 不应该抛出错误
      expect(() => testLogger.setLogFileOptions(1024, 3)).not.toThrow();
    });

    it("应该清理旧日志", () => {
      testLogger.initLogFile("/test/project");

      // 不应该抛出错误
      expect(() => testLogger.cleanupOldLogs()).not.toThrow();
    });

    it("应该处理日志轮转", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({
        size: BigInt(20 * 1024 * 1024),
        isFile: () => true,
        isDirectory: () => false,
        isBlockDevice: () => false,
        isCharacterDevice: () => false,
        isSymbolicLink: () => false,
        isFIFO: () => false,
        isSocket: () => false,
        dev: BigInt(0),
        ino: BigInt(0),
        mode: BigInt(0),
        nlink: BigInt(0),
        uid: BigInt(0),
        gid: BigInt(0),
        rdev: BigInt(0),
        blksize: BigInt(0),
        blocks: BigInt(0),
        atimeNs: BigInt(0),
        mtimeNs: BigInt(0),
        ctimeNs: BigInt(0),
        birthtimeNs: BigInt(0),
        atime: new Date(),
        mtime: new Date(),
        ctime: new Date(),
        birthtime: new Date(),
      } as any); // 20MB 文件

      testLogger.initLogFile("/test/project");

      // 轮转期间不应该抛出错误
      expect(() => testLogger.initLogFile("/test/project")).not.toThrow();
    });
  });

  describe("工具函数", () => {
    it("应该处理安全的写入操作", () => {
      const testLogger = new Logger();

      // 测试日志记录即使在边缘情况下也能工作
      expect(() => testLogger.info("Test message")).not.toThrow();
      expect(() => testLogger.error("Test error")).not.toThrow();
    });

    it("应该增强错误对象", () => {
      const testLogger = new Logger();
      const error = new Error("Test error");
      error.cause = new Error("Root cause");

      testLogger.error({ operation: "test", error }, "Operation failed");

      expect(mockPinoInstance.error).toHaveBeenCalled();
    });
  });
});
