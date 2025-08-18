import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Logger, logger } from "./logger.js";

// Mock dependencies
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
  createWriteStream: vi.fn(),
  WriteStream: vi.fn(),
}));

vi.mock("node:path", () => ({
  join: vi.fn(),
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

vi.mock("pino", () => {
  const mockPinoInstance = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
  };

  const mockPino = Object.assign(vi.fn(() => mockPinoInstance), {
    multistream: vi.fn(() => mockPinoInstance),
    destination: vi.fn(() => ({})),
    stdTimeFunctions: {
      isoTime: vi.fn(() => `,"time":${Date.now()}`),
    },
  });

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

  let mockWriteStream: any;
  let mockPinoInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock WriteStream
    mockWriteStream = {
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

    mockPino.mockReturnValue(mockPinoInstance);
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
      expect(mockFs.createWriteStream).toHaveBeenCalledWith(
        "/test/project/xiaozhi.log",
        {
          flags: "a",
        }
      );
    });

    it("should initialize log file when it already exists", () => {
      const testLogger = new Logger();
      mockFs.existsSync.mockReturnValue(true);

      testLogger.initLogFile("/test/project");

      expect(mockFs.writeFileSync).not.toHaveBeenCalled();
      expect(mockFs.createWriteStream).toHaveBeenCalledWith(
        "/test/project/xiaozhi.log",
        {
          flags: "a",
        }
      );
    });
  });

  describe("enableFileLogging", () => {
    it("should enable file logging when log file path is set", () => {
      const testLogger = new Logger();
      testLogger.initLogFile("/test/project");

      // First disable file logging to clear the write stream
      testLogger.enableFileLogging(false);

      // Clear the mock calls
      mockFs.createWriteStream.mockClear();

      testLogger.enableFileLogging(true);

      expect(mockFs.createWriteStream).toHaveBeenCalledWith(
        "/test/project/xiaozhi.log",
        {
          flags: "a",
        }
      );
    });

    it("should not enable file logging when log file path is not set", () => {
      const testLogger = new Logger();

      testLogger.enableFileLogging(true);

      expect(mockFs.createWriteStream).not.toHaveBeenCalled();
    });

    it("should disable file logging", () => {
      const testLogger = new Logger();
      testLogger.initLogFile("/test/project");

      testLogger.enableFileLogging(false);

      expect(mockWriteStream.end).toHaveBeenCalled();
    });

    it("should handle disable when no write stream exists", () => {
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

    it("should log info messages", () => {
      testLogger.info("Test info message", "arg1", "arg2");

      expect(mockPinoInstance.info).toHaveBeenCalledWith(
        "Test info message arg1 arg2"
      );
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

      expect(mockPinoInstance.error).toHaveBeenCalledWith(
        "Test error message"
      );
    });

    it("should log debug messages", () => {
      testLogger.debug("Test debug message");

      expect(mockPinoInstance.debug).toHaveBeenCalledWith(
        "Test debug message"
      );
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
    it("should close write stream when it exists", () => {
      const testLogger = new Logger();
      testLogger.initLogFile("/test/project");

      testLogger.close();

      expect(mockWriteStream.end).toHaveBeenCalled();
    });

    it("should handle close when no write stream exists", () => {
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

    it("should format log messages with timestamp", () => {
      testLogger.info("Test message");

      const writeCall = mockWriteStream.write.mock.calls[0][0];
      expect(writeCall).toMatch(
        /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] Test message\n/
      );
    });

    it("should handle object arguments", () => {
      const testObj = { key: "value", number: 42 };
      testLogger.info("Test message", testObj);

      const writeCall = mockWriteStream.write.mock.calls[0][0];
      expect(writeCall).toContain('{"key":"value","number":42}');
    });

    it("should handle mixed argument types", () => {
      testLogger.info(
        "Test message",
        "string",
        123,
        { obj: "value" },
        null,
        undefined
      );

      const writeCall = mockWriteStream.write.mock.calls[0][0];
      expect(writeCall).toContain("string 123");
      expect(writeCall).toContain('{"obj":"value"}');
      expect(writeCall).toContain("null undefined");
    });

    it("should not write to file when write stream is null", () => {
      testLogger.close(); // This sets writeStream to null

      testLogger.info("Test message");

      // Should still call consola but not write to file
      expect(mockConsolaInstance.info).toHaveBeenCalledWith("Test message");
      expect(mockWriteStream.write).not.toHaveBeenCalled();
    });
  });

  describe("formatDateTime", () => {
    it("should format date correctly", () => {
      // We can't directly test the private formatDateTime function,
      // but we can test its output through the reporter
      const testLogger = new Logger();

      // Get the reporter function that was set
      const reporterCall = mockConsolaInstance.setReporters.mock.calls[0][0][0];
      const mockLogObj = {
        type: "info",
        args: ["Test message"],
      };

      // Create a mock date that will return the expected local time
      // Since the formatDateTime function uses local time, we need to account for timezone
      const mockDate = {
        getFullYear: () => 2023,
        getMonth: () => 11, // December (0-based)
        getDate: () => 25,
        getHours: () => 10,
        getMinutes: () => 30,
        getSeconds: () => 45,
      };

      vi.spyOn(global, "Date").mockImplementation(() => mockDate as any);

      reporterCall.log(mockLogObj);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("[2023-12-25 10:30:45]")
      );

      vi.restoreAllMocks();
    });
  });

  describe("reporter functionality", () => {
    let testLogger: Logger;
    let reporter: any;

    beforeEach(() => {
      testLogger = new Logger();
      reporter = mockConsolaInstance.setReporters.mock.calls[0][0][0];
    });

    it("should format info messages with blue color", () => {
      const mockLogObj = {
        type: "info",
        args: ["Test info"],
      };

      reporter.log(mockLogObj);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("blue([INFO])")
      );
    });

    it("should format success messages with green color", () => {
      const mockLogObj = {
        type: "success",
        args: ["Test success"],
      };

      reporter.log(mockLogObj);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("green([SUCCESS])")
      );
    });

    it("should format warning messages with yellow color", () => {
      const mockLogObj = {
        type: "warn",
        args: ["Test warning"],
      };

      reporter.log(mockLogObj);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("yellow([WARN])")
      );
    });

    it("should format error messages with red color", () => {
      const mockLogObj = {
        type: "error",
        args: ["Test error"],
      };

      reporter.log(mockLogObj);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("red([ERROR])")
      );
    });

    it("should format debug messages with gray color", () => {
      const mockLogObj = {
        type: "debug",
        args: ["Test debug"],
      };

      reporter.log(mockLogObj);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("gray([DEBUG])")
      );
    });

    it("should handle unknown log types", () => {
      const mockLogObj = {
        type: "unknown",
        args: ["Test unknown"],
      };

      reporter.log(mockLogObj);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("[UNKNOWN]")
      );
    });

    it("should not output to console in daemon mode", () => {
      process.env.XIAOZHI_DAEMON = "true";
      const daemonLogger = new Logger();
      const daemonReporter =
        mockConsolaInstance.setReporters.mock.calls[1][0][0];

      const mockLogObj = {
        type: "info",
        args: ["Test daemon"],
      };

      daemonReporter.log(mockLogObj);

      // Should not call console.error in daemon mode
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    it("should handle EPIPE errors gracefully", () => {
      const mockLogObj = {
        type: "info",
        args: ["Test message"],
      };

      // Mock console.error to throw EPIPE error
      mockConsoleError.mockImplementation(() => {
        const error = new Error("EPIPE: broken pipe");
        error.message = "EPIPE: broken pipe";
        throw error;
      });

      // Should not throw error
      expect(() => reporter.log(mockLogObj)).not.toThrow();
    });

    it("should re-throw non-EPIPE errors", () => {
      const mockLogObj = {
        type: "info",
        args: ["Test message"],
      };

      // Mock console.error to throw non-EPIPE error
      mockConsoleError.mockImplementation(() => {
        throw new Error("Other error");
      });

      // Should throw the error
      expect(() => reporter.log(mockLogObj)).toThrow("Other error");
    });

    it("should join multiple arguments", () => {
      // Reset the mock to ensure it doesn't throw errors from previous tests
      mockConsoleError.mockReset();

      const mockLogObj = {
        type: "info",
        args: ["Message", "arg1", "arg2", 123],
      };

      reporter.log(mockLogObj);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("Message arg1 arg2 123")
      );
    });
  });
});
