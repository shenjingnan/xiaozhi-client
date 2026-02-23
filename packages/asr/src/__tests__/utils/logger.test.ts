/**
 * Logger 工具测试
 */

import { LogLevel, Logger, logger } from "@/utils/index.js";
import { describe, expect, it, vi } from "vitest";

describe("Logger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应使用默认参数创建 Logger", () => {
    const logger = new Logger();

    expect(logger).toBeDefined();
  });

  it("应使用自定义前缀创建 Logger", () => {
    const testLogger = new Logger("TestPrefix");

    expect(testLogger).toBeDefined();
  });

  it("应使用自定义日志级别创建 Logger", () => {
    const testLogger = new Logger("Test", LogLevel.ERROR);

    expect(testLogger).toBeDefined();
  });

  it("DEBUG 级别应输出所有日志", () => {
    const testLogger = new Logger("DEBUG_TEST", LogLevel.DEBUG);
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    testLogger.debug("debug message");
    testLogger.info("info message");
    testLogger.warn("warn message");
    testLogger.error("error message");

    // console.debug 在某些环境中可能不存在，检查调用次数
    const debugCalls = debugSpy.mock.calls.length;
    const infoCalls = infoSpy.mock.calls.length;
    const warnCalls = warnSpy.mock.calls.length;
    const errorCalls = errorSpy.mock.calls.length;

    // 总调用次数应该是 4 次
    expect(debugCalls + infoCalls + warnCalls + errorCalls).toBe(4);
  });

  it("INFO 级别应输出 info、warn、error 日志", () => {
    const testLogger = new Logger("INFO_TEST", LogLevel.INFO);
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    testLogger.debug("debug message");
    testLogger.info("info message");
    testLogger.warn("warn message");
    testLogger.error("error message");

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("WARN 级别应输出 warn、error 日志", () => {
    const testLogger = new Logger("WARN_TEST", LogLevel.WARN);
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    testLogger.debug("debug message");
    testLogger.info("info message");
    testLogger.warn("warn message");
    testLogger.error("error message");

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("ERROR 级别应只输出 error 日志", () => {
    const testLogger = new Logger("ERROR_TEST", LogLevel.ERROR);
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    testLogger.debug("debug message");
    testLogger.info("info message");
    testLogger.warn("warn message");
    testLogger.error("error message");

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("应正确设置日志级别", () => {
    const testLogger = new Logger("SET_LEVEL", LogLevel.DEBUG);
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

    testLogger.setLevel(LogLevel.ERROR);
    testLogger.debug("debug message");

    expect(debugSpy).not.toHaveBeenCalled();
  });

  it("应正确输出带前缀的日志", () => {
    const testLogger = new Logger("PREFIX", LogLevel.INFO);
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    testLogger.info("test message");

    expect(infoSpy).toHaveBeenCalledWith("[PREFIX]", "test message");
  });

  it("应正确输出多个参数", () => {
    const testLogger = new Logger("MULTI", LogLevel.INFO);
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    testLogger.info("message1", "message2", { key: "value" });

    expect(infoSpy).toHaveBeenCalledWith("[MULTI]", "message1", "message2", {
      key: "value",
    });
  });

  it("默认 logger 应正确工作", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logger.error("error message");

    expect(errorSpy).toHaveBeenCalledWith("[ASR]", "error message");
  });

  it("WARN 日志级别值应为 2", () => {
    expect(LogLevel.WARN).toBe(2);
  });

  it("ERROR 日志级别值应为 3", () => {
    expect(LogLevel.ERROR).toBe(3);
  });
});
