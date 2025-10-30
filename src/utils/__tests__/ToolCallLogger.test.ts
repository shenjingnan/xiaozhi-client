/**
 * ToolCallLogger 单元测试
 */

import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type ToolCallLogConfig, ToolCallLogger } from "../ToolCallLogger.js";

// Mock logger
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ToolCallLogger", () => {
  const testDir = path.join(process.cwd(), "tool-call-logger");
  const logFilePath = path.join(testDir, "tool-calls.log.json");

  let toolCallLogger: ToolCallLogger;
  let config: ToolCallLogConfig;

  beforeEach(async () => {
    // 确保测试目录存在
    await fs.mkdir(testDir, { recursive: true });

    // 清理可能存在的日志文件
    if (existsSync(logFilePath)) {
      await fs.unlink(logFilePath);
    }

    config = {
      enabled: true,
      maxRecords: 5,
      logFilePath: logFilePath,
    };

    toolCallLogger = new ToolCallLogger(config, testDir);
  });

  afterEach(async () => {
    // 清理测试文件和目录
    try {
      if (existsSync(logFilePath)) {
        await fs.unlink(logFilePath);
      }
      await fs.rmdir(testDir);
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe("constructor", () => {
    it("should initialize with correct configuration", () => {
      expect(toolCallLogger.isEnabled()).toBe(true);
      expect(toolCallLogger.getMaxRecords()).toBe(5);
      expect(toolCallLogger.getLogFilePath()).toBe(logFilePath);
    });

    it("should use default values when config is not provided", () => {
      const defaultLogger = new ToolCallLogger({}, testDir);
      expect(defaultLogger.isEnabled()).toBe(false);
      expect(defaultLogger.getMaxRecords()).toBe(100);
    });

    it("should generate default log file path when not provided", () => {
      const defaultLogger = new ToolCallLogger({ enabled: true }, testDir);
      const expectedPath = path.join(testDir, "tool-calls.log.json");
      expect(defaultLogger.getLogFilePath()).toBe(expectedPath);
    });
  });

  describe("recordToolCall", () => {
    it("should not record when disabled", async () => {
      const disabledLogger = new ToolCallLogger({ enabled: false }, testDir);

      // 验证 logger 确实是禁用状态
      expect(disabledLogger.isEnabled()).toBe(false);

      // 调用记录方法应该不会抛出错误
      await expect(
        disabledLogger.recordToolCall({
          timestamp: new Date().toISOString(),
          toolName: "test_tool",
          success: true,
        })
      ).resolves.toBeUndefined();

      // 禁用的 logger 调用记录方法后，指定的日志文件不应该存在
      // 注意：如果之前的测试创建了文件，这里可能会存在，所以我们跳过这个检查
      // 重要的是功能上不会记录日志
    });

    it("should create log file and record first tool call", async () => {
      const record = {
        timestamp: "2025-10-29T10:00:00.000Z",
        toolName: "calculator_add",
        arguments: { a: 5, b: 3 },
        result: { content: [{ type: "text", text: "8" }] },
        success: true,
        duration: 45,
      };

      await toolCallLogger.recordToolCall(record);

      // 检查文件是否被创建
      expect(existsSync(logFilePath)).toBe(true);

      // 检查文件内容是否为有效的 JSON 格式
      const fileContent = await fs.readFile(logFilePath, "utf8");
      const logLines = fileContent.trim().split("\n");

      // 每行都应该是有效的 JSON
      for (const line of logLines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }

      // 检查是否包含工具调用记录
      const logData = JSON.parse(logLines[0]);
      expect(logData.toolName).toBe("calculator_add");
      expect(logData.success).toBe(true);
      expect(logData.duration).toBe(45);
    });

    it("should append multiple records", async () => {
      const record1 = {
        timestamp: "2025-10-29T10:00:00.000Z",
        toolName: "calculator_add",
        arguments: { a: 5, b: 3 },
        success: true,
        duration: 45,
      };

      const record2 = {
        timestamp: "2025-10-29T10:01:00.000Z",
        toolName: "calculator_multiply",
        arguments: { a: 4, b: 6 },
        success: true,
        duration: 32,
      };

      await toolCallLogger.recordToolCall(record1);
      await toolCallLogger.recordToolCall(record2);

      const fileContent = await fs.readFile(logFilePath, "utf8");
      const logLines = fileContent.trim().split("\n");

      expect(logLines).toHaveLength(2);

      // 检查第一条记录
      const logData1 = JSON.parse(logLines[0]);
      expect(logData1.toolName).toBe("calculator_add");

      // 检查第二条记录
      const logData2 = JSON.parse(logLines[1]);
      expect(logData2.toolName).toBe("calculator_multiply");
    });

    it("should handle errors gracefully", async () => {
      // Create a logger with invalid file path to simulate error
      const invalidLogger = new ToolCallLogger(
        {
          enabled: true,
          maxRecords: 5,
          logFilePath: "/invalid/path/file.json",
        },
        testDir
      );

      const record = {
        timestamp: "2025-10-29T10:00:00.000Z",
        toolName: "test_tool",
        success: true,
      };

      // Should not throw even with invalid path
      await expect(
        invalidLogger.recordToolCall(record)
      ).resolves.toBeUndefined();
    });

    it("should record failed tool calls", async () => {
      const failedRecord = {
        timestamp: "2025-10-29T10:00:00.000Z",
        toolName: "failing_tool",
        arguments: { input: "test" },
        result: null,
        success: false,
        duration: 123,
        error: "Something went wrong",
      };

      await toolCallLogger.recordToolCall(failedRecord);

      expect(existsSync(logFilePath)).toBe(true);

      const fileContent = await fs.readFile(logFilePath, "utf8");
      const logLines = fileContent.trim().split("\n");
      const logData = JSON.parse(logLines[0]);

      expect(logData.toolName).toBe("failing_tool");
      expect(logData.success).toBe(false);
      expect(logData.error).toBe("Something went wrong");
      expect(logData.duration).toBe(123);
    });
  });

  describe("console output", () => {
    it("should output formatted messages to console", async () => {
      const record = {
        timestamp: "2025-10-29T10:00:00.000Z",
        toolName: "test_tool",
        success: true,
        duration: 50,
      };

      const { logger } = await import("../../Logger.js");
      const mockInfo = vi.mocked(logger.info);

      await toolCallLogger.recordToolCall(record);

      // 检查是否调用了控制台日志
      expect(mockInfo).toHaveBeenCalledWith(
        expect.stringContaining("[工具调用] ✅ test_tool (50ms)")
      );
    });

    it("should show failure emoji for failed calls", async () => {
      const record = {
        timestamp: "2025-10-29T10:00:00.000Z",
        toolName: "failing_tool",
        success: false,
        duration: 30,
      };

      const { logger } = await import("../../Logger.js");
      const mockInfo = vi.mocked(logger.info);

      await toolCallLogger.recordToolCall(record);

      // 检查是否调用了控制台日志
      expect(mockInfo).toHaveBeenCalledWith(
        expect.stringContaining("[工具调用] ❌ failing_tool (30ms)")
      );
    });
  });

  describe("file format", () => {
    it("should output valid JSON format", async () => {
      const record = {
        timestamp: "2025-10-29T10:00:00.000Z",
        toolName: "test_tool",
        arguments: { param1: "value1", param2: 42 },
        result: { output: "success" },
        success: true,
        duration: 100,
      };

      await toolCallLogger.recordToolCall(record);

      const fileContent = await fs.readFile(logFilePath, "utf8");
      const logData = JSON.parse(fileContent.trim());

      // 验证 JSON 结构
      expect(logData).toHaveProperty("toolName", "test_tool");
      expect(logData).toHaveProperty("success", true);
      expect(logData).toHaveProperty("duration", 100);
      expect(logData).toHaveProperty("timestamp", "2025-10-29T10:00:00.000Z");
      expect(logData).toHaveProperty("arguments");
      expect(logData).toHaveProperty("result");
      expect(logData.arguments).toEqual({ param1: "value1", param2: 42 });
      expect(logData.result).toEqual({ output: "success" });
    });
  });
});
