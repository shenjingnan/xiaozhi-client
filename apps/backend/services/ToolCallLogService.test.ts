/**
 * 工具调用日志服务测试
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ToolCallRecord } from "@utils/ToolCallLogger.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ToolCallLogService } from "./ToolCallLogService.js";

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
