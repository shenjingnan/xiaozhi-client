/**
 * 工具调用日志服务测试
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ToolCallRecord } from "../utils/ToolCallLogger.js";
import { ExportFormat, ToolCallLogService } from "./ToolCallLogService.js";

describe("ToolCallLogService", () => {
  let toolCallLogService: ToolCallLogService;
  let tempDir: string;
  let logFilePath: string;

  beforeEach(() => {
    // 创建临时目录
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tool-call-test-"));
    logFilePath = path.join(tempDir, "tool-calls.jsonl");

    // 创建服务实例
    toolCallLogService = new ToolCallLogService(tempDir);
  });

  afterEach(() => {
    // 清理临时文件和目录
    try {
      if (fs.existsSync(logFilePath)) {
        fs.unlinkSync(logFilePath);
      }
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn("清理临时文件失败:", error);
    }
  });

  describe("getToolCallLogs", () => {
    it("应该返回空的日志记录列表", async () => {
      // 不创建日志文件，测试空文件情况
      // 创建空日志文件
      fs.writeFileSync(logFilePath, "", "utf8");

      const result = await toolCallLogService.getToolCallLogs();
      expect(result.records).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it("应该正确解析和返回日志记录", async () => {
      // 创建测试数据
      const testRecords: ToolCallRecord[] = [
        {
          toolName: "test_tool_1",
          serverName: "test_server",
          success: true,
          duration: 100,
          arguments: { input: "test" },
          result: { output: "success" },
          timestamp: Date.now() - 1000,
        },
        {
          toolName: "test_tool_2",
          serverName: "test_server",
          success: false,
          duration: 200,
          error: "Test error",
          timestamp: Date.now(),
        },
      ];

      // 写入测试数据到日志文件
      const logData = testRecords
        .map((record) => JSON.stringify(record))
        .join("\n");
      fs.writeFileSync(logFilePath, logData, "utf8");

      const result = await toolCallLogService.getToolCallLogs();

      expect(result.records).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);

      // 验证记录按时间戳倒序排列
      expect(result.records[0].toolName).toBe("test_tool_2");
      expect(result.records[1].toolName).toBe("test_tool_1");
    });

    it("应该正确应用查询参数过滤", async () => {
      const testRecords: ToolCallRecord[] = [
        {
          toolName: "search_tool",
          serverName: "search_server",
          success: true,
          duration: 50,
          timestamp: Date.now() - 2000,
        },
        {
          toolName: "calculate_tool",
          serverName: "math_server",
          success: false,
          duration: 100,
          timestamp: Date.now() - 1000,
        },
        {
          toolName: "search_tool",
          serverName: "search_server",
          success: true,
          duration: 75,
          timestamp: Date.now(),
        },
      ];

      const logData = testRecords
        .map((record) => JSON.stringify(record))
        .join("\n");
      fs.writeFileSync(logFilePath, logData, "utf8");

      // 测试按工具名称过滤
      const result1 = await toolCallLogService.getToolCallLogs({
        toolName: "search_tool",
      });
      expect(result1.records).toHaveLength(2);
      expect(result1.total).toBe(2);

      // 测试按服务器名称过滤
      const result2 = await toolCallLogService.getToolCallLogs({
        serverName: "math_server",
      });
      expect(result2.records).toHaveLength(1);
      expect(result2.total).toBe(1);

      // 测试按成功状态过滤
      const result3 = await toolCallLogService.getToolCallLogs({
        success: false,
      });
      expect(result3.records).toHaveLength(1);
      expect(result3.total).toBe(1);

      // 测试分页
      const result4 = await toolCallLogService.getToolCallLogs({
        limit: 1,
        offset: 1,
      });
      expect(result4.records).toHaveLength(1);
      expect(result4.total).toBe(3);
      expect(result4.hasMore).toBe(true);
    });

    it("应该正确处理时间范围过滤", async () => {
      const now = Date.now();
      const testRecords: ToolCallRecord[] = [
        {
          toolName: "tool1",
          success: true,
          timestamp: now - 5000, // 5秒前
        },
        {
          toolName: "tool2",
          success: true,
          timestamp: now - 2000, // 2秒前
        },
        {
          toolName: "tool3",
          success: true,
          timestamp: now, // 现在
        },
      ];

      const logData = testRecords
        .map((record) => JSON.stringify(record))
        .join("\n");
      fs.writeFileSync(logFilePath, logData, "utf8");

      const startDate = new Date(now - 3000).toISOString(); // 3秒前
      const endDate = new Date(now - 1000).toISOString(); // 1秒前

      const result = await toolCallLogService.getToolCallLogs({
        startDate,
        endDate,
      });

      expect(result.records).toHaveLength(1);
      expect(result.records[0].toolName).toBe("tool2");
    });
  });

  describe("getToolCallStats", () => {
    it("应该正确计算统计数据", async () => {
      const testRecords: ToolCallRecord[] = [
        {
          toolName: "search_tool",
          success: true,
          duration: 100,
          serverName: "search_server",
        },
        {
          toolName: "search_tool",
          success: false,
          duration: 150,
          serverName: "search_server",
        },
        {
          toolName: "calculate_tool",
          success: true,
          duration: 50,
          serverName: "math_server",
        },
        {
          toolName: "search_tool",
          success: true,
          duration: 120,
          serverName: "search_server",
        },
      ];

      const logData = testRecords
        .map((record) => JSON.stringify(record))
        .join("\n");
      fs.writeFileSync(logFilePath, logData, "utf8");

      const stats = await toolCallLogService.getToolCallStats();

      expect(stats.totalCalls).toBe(4);
      expect(stats.successfulCalls).toBe(3);
      expect(stats.failedCalls).toBe(1);
      expect(stats.averageDuration).toBe(105); // (100 + 150 + 50 + 120) / 4

      // 验证最常用工具
      expect(stats.mostUsedTools).toHaveLength(2);
      expect(stats.mostUsedTools[0]).toEqual({
        toolName: "search_tool",
        count: 3,
      });
      expect(stats.mostUsedTools[1]).toEqual({
        toolName: "calculate_tool",
        count: 1,
      });

      // 验证按服务器的统计
      expect(stats.callsByServer).toHaveLength(2);
      expect(stats.callsByServer[0]).toEqual({
        serverName: "search_server",
        count: 3,
      });
      expect(stats.callsByServer[1]).toEqual({
        serverName: "math_server",
        count: 1,
      });
    });

    it("应该正确处理没有持续时间记录的情况", async () => {
      const testRecords: ToolCallRecord[] = [
        {
          toolName: "tool1",
          success: true,
        },
        {
          toolName: "tool2",
          success: true,
          duration: 100,
        },
      ];

      const logData = testRecords
        .map((record) => JSON.stringify(record))
        .join("\n");
      fs.writeFileSync(logFilePath, logData, "utf8");

      const stats = await toolCallLogService.getToolCallStats();

      expect(stats.averageDuration).toBe(100); // 只计算有持续时间的记录
    });
  });

  describe("exportToolCallLogs", () => {
    beforeEach(() => {
      const testRecords: ToolCallRecord[] = [
        {
          toolName: "export_test",
          serverName: "test_server",
          success: true,
          duration: 100,
          arguments: { input: "test" },
          result: { output: "success" },
          timestamp: Date.now(),
        },
      ];

      const logData = testRecords
        .map((record) => JSON.stringify(record))
        .join("\n");
      fs.writeFileSync(logFilePath, logData, "utf8");
    });

    it("应该导出 JSON 格式的日志", async () => {
      const exportedData = await toolCallLogService.exportToolCallLogs(
        {},
        ExportFormat.JSON
      );

      const parsed = JSON.parse(exportedData);
      expect(parsed).toHaveProperty("exportedAt");
      expect(parsed).toHaveProperty("totalRecords", 1);
      expect(parsed).toHaveProperty("records");
      expect(Array.isArray(parsed.records)).toBe(true);
      expect(parsed.records[0].toolName).toBe("export_test");
    });

    it("应该导出 CSV 格式的日志", async () => {
      const exportedData = await toolCallLogService.exportToolCallLogs(
        {},
        ExportFormat.CSV
      );

      expect(exportedData).toContain(
        '"Timestamp","Tool Name","Original Tool Name"'
      );
      expect(exportedData).toContain("export_test");
      expect(exportedData).toContain("test_server");

      const lines = exportedData
        .split("\n")
        .filter((line) => line.trim() !== "");
      expect(lines).toHaveLength(2); // header + data
    });
  });

  describe("clearToolCallLogs", () => {
    it("应该清空日志文件", async () => {
      // 创建测试日志文件
      const testRecords: ToolCallRecord[] = [
        {
          toolName: "test_tool",
          success: true,
        },
      ];

      const logData = testRecords
        .map((record) => JSON.stringify(record))
        .join("\n");
      fs.writeFileSync(logFilePath, logData, "utf8");

      // 确认文件存在且有内容
      expect(fs.existsSync(logFilePath)).toBe(true);
      expect(fs.readFileSync(logFilePath, "utf8")).not.toBe("");

      // 清空日志
      await toolCallLogService.clearToolCallLogs();

      // 确认文件被清空
      expect(fs.existsSync(logFilePath)).toBe(true);
      expect(fs.readFileSync(logFilePath, "utf8")).toBe("");
    });

    it("应该能清空自动创建的空文件", async () => {
      // 由于 ToolCallLogger 会在初始化时自动创建文件，
      // 我们只需要测试清空空文件是否正常工作

      // 确保文件存在但为空
      fs.writeFileSync(logFilePath, "", "utf8");

      // 清空日志应该成功
      await expect(
        toolCallLogService.clearToolCallLogs()
      ).resolves.toBeUndefined();

      // 确认文件仍然存在且为空
      expect(fs.existsSync(logFilePath)).toBe(true);
      expect(fs.readFileSync(logFilePath, "utf8")).toBe("");
    });
  });

  describe("getLogFileInfo", () => {
    it("应该返回正确的文件信息", async () => {
      // 创建测试日志文件
      const testRecords: ToolCallRecord[] = [
        {
          toolName: "test_tool",
          success: true,
        },
      ];

      const logData = testRecords
        .map((record) => JSON.stringify(record))
        .join("\n");
      fs.writeFileSync(logFilePath, logData, "utf8");

      const fileInfo = await toolCallLogService.getLogFileInfo();

      expect(fileInfo.exists).toBe(true);
      expect(fileInfo.path).toBe(logFilePath);
      expect(fileInfo.size).toBeGreaterThan(0);
      expect(fileInfo.recordCount).toBe(1);
      expect(fileInfo.lastModified).toBeTruthy();
    });

    it("应该正确处理空文件", async () => {
      // ToolCallLogger 会自动创建文件，所以我们测试空文件的情况
      fs.writeFileSync(logFilePath, "", "utf8");

      const fileInfo = await toolCallLogService.getLogFileInfo();

      expect(fileInfo.exists).toBe(true); // 文件存在，但是是空的
      expect(fileInfo.path).toBe(logFilePath);
      expect(fileInfo.size).toBe(0);
      expect(fileInfo.recordCount).toBe(0);
    });
  });

  describe("边界情况处理", () => {
    it("应该跳过无效的 JSON 行", async () => {
      const invalidLogData = [
        '{"toolName": "valid_record", "success": true}',
        "invalid json line",
        '{"toolName": "another_valid", "success": false}',
        "",
      ].join("\n");

      fs.writeFileSync(logFilePath, invalidLogData, "utf8");

      const result = await toolCallLogService.getToolCallLogs();

      expect(result.records).toHaveLength(2);
      expect(result.total).toBe(2);
      // 验证记录包含两个有效的工具名称（顺序可能因为时间戳相同而不同）
      const toolNames = result.records.map((r) => r.toolName);
      expect(toolNames).toContain("another_valid");
      expect(toolNames).toContain("valid_record");
    });

    it("应该处理空文件", async () => {
      // 创建空文件
      fs.writeFileSync(logFilePath, "", "utf8");

      const result = await toolCallLogService.getToolCallLogs();

      expect(result.records).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it("应该处理只包含空行的文件", async () => {
      const logData = "\n\n\n";
      fs.writeFileSync(logFilePath, logData, "utf8");

      const result = await toolCallLogService.getToolCallLogs();

      expect(result.records).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("应该限制最大返回数量", async () => {
      const testRecords: ToolCallRecord[] = Array.from(
        { length: 10 },
        (_, i) => ({
          toolName: `tool_${i}`,
          success: true,
          timestamp: Date.now() - i * 1000,
        })
      );

      const logData = testRecords
        .map((record) => JSON.stringify(record))
        .join("\n");
      fs.writeFileSync(logFilePath, logData, "utf8");

      const result = await toolCallLogService.getToolCallLogs({ limit: 5 });

      expect(result.records).toHaveLength(5);
      expect(result.total).toBe(10);
      expect(result.hasMore).toBe(true);
    });
  });
});
