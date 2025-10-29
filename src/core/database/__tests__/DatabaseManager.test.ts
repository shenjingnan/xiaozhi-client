/**
 * DatabaseManager 单元测试
 */

import * as fs from "node:fs";
import { promises as fsPromises } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseManager } from "../DatabaseManager.js";
import type { LogCategory, LogEntry, LogLevel } from "../types.js";

describe("DatabaseManager", () => {
  let dbManager: DatabaseManager;
  let testDir: string;

  beforeEach(async () => {
    // 创建临时测试目录
    testDir = await fsPromises.mkdtemp(path.join(tmpdir(), "xiaozhi-test-"));
    dbManager = new DatabaseManager(testDir);
  });

  afterEach(() => {
    // 清理测试环境
    dbManager.close();

    // 删除测试目录和文件
    try {
      fsPromises.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe("initialize", () => {
    it("应该成功初始化数据库", () => {
      const result = dbManager.initialize();

      expect(result.success).toBe(true);
      expect(result.tablesCreated).toContain("logs");
      expect(dbManager.isAvailable()).toBe(true);
    });

    it("应该创建数据库文件", () => {
      dbManager.initialize();
      const dbPath = dbManager.getDbPath();
      expect(fs.existsSync(dbPath)).toBe(true);
    });

    it("应该支持重复初始化", () => {
      const result1 = dbManager.initialize();
      const result2 = dbManager.initialize();

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it("应该处理无效路径的情况", () => {
      // 创建一个只读目录来模拟错误情况
      const invalidDbManager = new DatabaseManager(
        "/invalid/path/that/does/not/exist"
      );
      const result = invalidDbManager.initialize();

      // 根据实现，这应该成功（因为会创建目录）
      expect(result.success).toBe(true);
      invalidDbManager.close();
    });
  });

  describe("insertLog", () => {
    beforeEach(() => {
      dbManager.initialize();
    });

    it("应该成功插入日志记录", () => {
      const logEntry: LogEntry = {
        level: "info",
        category: "mcp_tool",
        type: "tool_call",
        message: "测试日志消息",
        metadata: { toolName: "test_tool" },
        sessionId: "test-session-123",
      };

      const result = dbManager.insertLog(logEntry);

      expect(result.success).toBe(true);
      expect(result.logId).toBeDefined();
      expect(typeof result.logId).toBe("number");
    });

    it("应该处理无元数据的日志", () => {
      const logEntry: LogEntry = {
        level: "error",
        category: "system",
        type: "startup",
        message: "系统启动失败",
      };

      const result = dbManager.insertLog(logEntry);

      expect(result.success).toBe(true);
      expect(result.logId).toBeDefined();
    });

    it("应该处理无会话ID的日志", () => {
      const logEntry: LogEntry = {
        level: "warn",
        category: "general",
        type: "warning",
        message: "这是一个警告消息",
        metadata: { warning: "test warning" },
      };

      const result = dbManager.insertLog(logEntry);

      expect(result.success).toBe(true);
      expect(result.logId).toBeDefined();
    });

    it("应该处理所有日志级别", () => {
      const levels: LogLevel[] = ["debug", "info", "warn", "error"];

      for (const level of levels) {
        const logEntry: LogEntry = {
          level,
          category: "general",
          type: "test",
          message: `${level} 级别测试消息`,
        };

        const result = dbManager.insertLog(logEntry);
        expect(result.success).toBe(true);
      }
    });

    it("应该处理复杂的元数据对象", () => {
      const complexMetadata = {
        toolName: "complex_tool",
        arguments: {
          param1: "value1",
          param2: 42,
          param3: { nested: "object" },
          param4: ["array", "values"],
        },
        result: {
          success: true,
          data: { items: [1, 2, 3] },
        },
        duration: 1234,
      };

      const logEntry: LogEntry = {
        level: "info",
        category: "mcp_tool",
        type: "tool_call",
        message: "复杂工具调用",
        metadata: complexMetadata,
      };

      const result = dbManager.insertLog(logEntry);

      expect(result.success).toBe(true);
      expect(result.logId).toBeDefined();
    });

    it("应该在数据库未初始化时返回错误", () => {
      const uninitializedDbManager = new DatabaseManager(testDir);
      const logEntry: LogEntry = {
        level: "info",
        category: "general",
        type: "test",
        message: "测试消息",
      };

      const result = uninitializedDbManager.insertLog(logEntry);

      expect(result.success).toBe(false);
      expect(result.error).toBe("数据库连接未初始化");

      uninitializedDbManager.close();
    });
  });

  describe("queryLogs", () => {
    const testLogs: LogEntry[] = [
      {
        level: "info",
        category: "mcp_tool",
        type: "tool_call",
        message: "工具调用1",
        metadata: { tool: "tool1" },
        sessionId: "session1",
      },
      {
        level: "error",
        category: "system",
        type: "startup",
        message: "启动错误",
        metadata: { error: "startup failed" },
      },
      {
        level: "warn",
        category: "connection",
        type: "reconnect",
        message: "重新连接",
        sessionId: "session2",
      },
      {
        level: "debug",
        category: "general",
        type: "debug_info",
        message: "调试信息",
      },
    ];

    beforeEach(() => {
      dbManager.initialize();
      // 插入测试数据
      for (const log of testLogs) {
        dbManager.insertLog(log);
      }
    });

    it("应该查询所有日志", () => {
      const logs = dbManager.queryLogs();

      expect(logs).toHaveLength(testLogs.length);
      expect(logs[0]).toHaveProperty("level");
      expect(logs[0]).toHaveProperty("category");
      expect(logs[0]).toHaveProperty("type");
      expect(logs[0]).toHaveProperty("message");
    });

    it("应该按日志级别过滤", () => {
      const infoLogs = dbManager.queryLogs({ level: "info" });

      expect(infoLogs).toHaveLength(1);
      expect(infoLogs[0].level).toBe("info");
      expect(infoLogs[0].message).toBe("工具调用1");
    });

    it("应该按日志分类过滤", () => {
      const systemLogs = dbManager.queryLogs({ category: "system" });

      expect(systemLogs).toHaveLength(1);
      expect(systemLogs[0].category).toBe("system");
      expect(systemLogs[0].message).toBe("启动错误");
    });

    it("应该按会话ID过滤", () => {
      const session1Logs = dbManager.queryLogs({ sessionId: "session1" });

      expect(session1Logs).toHaveLength(1);
      expect(session1Logs[0].sessionId).toBe("session1");
      expect(session1Logs[0].message).toBe("工具调用1");
    });

    it("应该按类型过滤", () => {
      const toolCallLogs = dbManager.queryLogs({ type: "tool_call" });

      expect(toolCallLogs).toHaveLength(1);
      expect(toolCallLogs[0].type).toBe("tool_call");
    });

    it("应该支持限制结果数量", () => {
      const limitedLogs = dbManager.queryLogs({ limit: 2 });

      expect(limitedLogs).toHaveLength(2);
    });

    it("应该支持偏移量", () => {
      const offsetLogs = dbManager.queryLogs({ limit: 2, offset: 1 });

      expect(offsetLogs).toHaveLength(2);
      expect(offsetLogs[0].message).not.toBe("工具调用1"); // 第一条应该被跳过
    });

    it("应该支持升序排序", () => {
      const ascLogs = dbManager.queryLogs({ orderBy: "ASC" });

      expect(ascLogs).toHaveLength(testLogs.length);
      // 检查是否按时间升序排列（第一条应该是最早的）
      expect(ascLogs[0].message).toBe("工具调用1");
    });

    it("应该支持降序排序（默认）", () => {
      const descLogs = dbManager.queryLogs({ orderBy: "DESC" });

      expect(descLogs).toHaveLength(testLogs.length);
      // 检查是否按时间降序排列（第一条应该是最新的）
      expect(descLogs[0].message).toBe("调试信息");
    });

    it("应该在数据库未初始化时返回空数组", () => {
      const uninitializedDbManager = new DatabaseManager(testDir);
      const logs = uninitializedDbManager.queryLogs();

      expect(logs).toEqual([]);

      uninitializedDbManager.close();
    });

    it("应该正确解析元数据", () => {
      const logs = dbManager.queryLogs({ level: "info" });
      const logWithMetadata = logs[0];

      expect(logWithMetadata.metadata).toEqual({ tool: "tool1" });
    });
  });

  describe("getStats", () => {
    beforeEach(() => {
      dbManager.initialize();
    });

    it("应该返回正确的统计信息", () => {
      // 插入一些测试数据
      const testLogs: LogEntry[] = [
        {
          level: "info",
          category: "mcp_tool",
          type: "tool_call",
          message: "info",
        },
        {
          level: "info",
          category: "system",
          type: "startup",
          message: "info2",
        },
        { level: "error", category: "system", type: "error", message: "error" },
        {
          level: "warn",
          category: "connection",
          type: "reconnect",
          message: "warn",
        },
        {
          level: "debug",
          category: "general",
          type: "debug",
          message: "debug",
        },
      ];

      for (const log of testLogs) {
        dbManager.insertLog(log);
      }

      const stats = dbManager.getStats();

      expect(stats.totalLogs).toBe(5);
      expect(stats.logsByLevel.info).toBe(2);
      expect(stats.logsByLevel.error).toBe(1);
      expect(stats.logsByLevel.warn).toBe(1);
      expect(stats.logsByLevel.debug).toBe(1);
      expect(stats.logsByCategory.mcp_tool).toBe(1);
      expect(stats.logsByCategory.system).toBe(2);
      expect(stats.logsByCategory.connection).toBe(1);
      expect(stats.logsByCategory.general).toBe(1);
      expect(stats.oldestLog).toBeInstanceOf(Date);
      expect(stats.newestLog).toBeInstanceOf(Date);
    });

    it("应该处理空数据库的统计信息", () => {
      const stats = dbManager.getStats();

      expect(stats.totalLogs).toBe(0);
      expect(stats.logsByLevel).toEqual({
        debug: 0,
        info: 0,
        warn: 0,
        error: 0,
      });
      expect(stats.logsByCategory).toEqual({});
      expect(stats.oldestLog).toBeUndefined();
      expect(stats.newestLog).toBeUndefined();
    });

    it("应该在数据库未初始化时返回默认统计信息", () => {
      const uninitializedDbManager = new DatabaseManager(testDir);
      const stats = uninitializedDbManager.getStats();

      expect(stats.totalLogs).toBe(0);
      expect(stats.logsByLevel).toEqual({
        debug: 0,
        info: 0,
        warn: 0,
        error: 0,
      });

      uninitializedDbManager.close();
    });
  });

  describe("cleanupOldLogs", () => {
    beforeEach(() => {
      dbManager.initialize();
    });

    it("应该清理指定日期之前的日志", () => {
      // 插入一些测试日志
      const testLog: LogEntry = {
        level: "info",
        category: "general",
        type: "test",
        message: "测试日志",
      };

      dbManager.insertLog(testLog);

      // 获取插入后的统计信息
      const beforeStats = dbManager.getStats();
      expect(beforeStats.totalLogs).toBe(1);

      // 清理未来日期之前的日志（应该清理所有日志）
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const deletedCount = dbManager.cleanupOldLogs(futureDate);

      expect(deletedCount).toBe(1);

      // 验证日志已被清理
      const afterStats = dbManager.getStats();
      expect(afterStats.totalLogs).toBe(0);
    });

    it("应该不清理指定日期之后的日志", () => {
      // 插入测试日志
      const testLog: LogEntry = {
        level: "info",
        category: "general",
        type: "test",
        message: "测试日志",
      };

      dbManager.insertLog(testLog);

      // 清理过去日期之前的日志（应该不清理任何日志）
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const deletedCount = dbManager.cleanupOldLogs(pastDate);

      expect(deletedCount).toBe(0);

      // 验证日志仍然存在
      const stats = dbManager.getStats();
      expect(stats.totalLogs).toBe(1);
    });

    it("应该在数据库未初始化时返回0", () => {
      const uninitializedDbManager = new DatabaseManager(testDir);
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const deletedCount = uninitializedDbManager.cleanupOldLogs(pastDate);

      expect(deletedCount).toBe(0);

      uninitializedDbManager.close();
    });
  });

  describe("isAvailable", () => {
    it("应该在未初始化时返回false", () => {
      expect(dbManager.isAvailable()).toBe(false);
    });

    it("应该在初始化后返回true", () => {
      dbManager.initialize();
      expect(dbManager.isAvailable()).toBe(true);
    });

    it("应该在关闭后返回false", () => {
      dbManager.initialize();
      dbManager.close();
      expect(dbManager.isAvailable()).toBe(false);
    });
  });

  describe("getDbPath", () => {
    it("应该返回正确的数据库路径", () => {
      const dbPath = dbManager.getDbPath();
      expect(dbPath).toBe(path.join(testDir, "xiaozhi.db"));
    });
  });

  describe("close", () => {
    it("应该安全关闭数据库连接", () => {
      dbManager.initialize();
      expect(dbManager.isAvailable()).toBe(true);

      dbManager.close();
      expect(dbManager.isAvailable()).toBe(false);
    });

    it("应该可以多次调用close而不出错", () => {
      dbManager.initialize();
      dbManager.close();
      dbManager.close(); // 第二次调用应该不会出错

      expect(dbManager.isAvailable()).toBe(false);
    });
  });

  describe("错误处理和边界情况", () => {
    it("应该处理空的日志消息", () => {
      dbManager.initialize();
      const emptyLog: LogEntry = {
        level: "info",
        category: "general",
        type: "test",
        message: "",
      };

      const result = dbManager.insertLog(emptyLog);
      expect(result.success).toBe(true);
    });

    it("应该处理很长的日志消息", () => {
      dbManager.initialize();
      const longMessage = "a".repeat(10000); // 10KB 的消息
      const longLog: LogEntry = {
        level: "info",
        category: "general",
        type: "test",
        message: longMessage,
      };

      const result = dbManager.insertLog(longLog);
      expect(result.success).toBe(true);
    });

    it("应该处理特殊字符", () => {
      dbManager.initialize();
      const specialLog: LogEntry = {
        level: "info",
        category: "general",
        type: "test",
        message: "包含特殊字符的消息: ' \" \\ / \n \t 测试中文 🚀",
        metadata: { special: "特殊字符: ' \" \\ /" },
      };

      const result = dbManager.insertLog(specialLog);
      expect(result.success).toBe(true);

      // 验证可以正确查询
      const logs = dbManager.queryLogs({ level: "info" });
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toContain("特殊字符");
    });
  });
});
