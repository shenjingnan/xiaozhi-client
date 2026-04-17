import {
  formatDuration,
  formatError,
  formatJson,
  formatTimestamp,
  generateStableKey,
} from "@/utils/formatUtils";
import type { ToolCallRecord } from "@xiaozhi-client/shared-types";
import { describe, expect, it } from "vitest";

describe("formatUtils", () => {
  describe("formatTimestamp", () => {
    it("应该正确格式化有效时间戳", () => {
      const timestamp = 1704067200000; // 2024-01-01 12:00:00
      const result = formatTimestamp(timestamp);

      expect(result).toMatch(/\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}/);
      expect(result).toContain("2024");
      expect(result).toContain("01");
      expect(result).toContain("01");
    });

    it("应该处理无效时间戳", () => {
      expect(formatTimestamp(0)).toBe("未知时间");
      expect(formatTimestamp(undefined)).toBe("未知时间");
      expect(formatTimestamp(null as any)).toBe("未知时间");
    });

    it("应该处理负数时间戳", () => {
      const result = formatTimestamp(-1000);
      expect(result).toMatch(/\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}/);
    });
  });

  describe("formatDuration", () => {
    it("应该正确格式化毫秒级持续时间", () => {
      expect(formatDuration(100)).toBe("100ms");
      expect(formatDuration(999)).toBe("999ms");
    });

    it("应该正确格式化秒级持续时间", () => {
      expect(formatDuration(1000)).toBe("1.0s");
      expect(formatDuration(1500)).toBe("1.5s");
      expect(formatDuration(5000)).toBe("5.0s");
    });

    it("应该处理无效持续时间", () => {
      expect(formatDuration(0)).toBe("-");
      expect(formatDuration(undefined)).toBe("-");
      expect(formatDuration(null as any)).toBe("-");
    });

    it("应该处理负数持续时间", () => {
      expect(formatDuration(-100)).toBe("-100ms");
    });
  });

  describe("formatJson", () => {
    it("应该正确格式化有效JSON对象", () => {
      const data = { key: "value", number: 123 };
      const result = formatJson(data);

      expect(result).toBe('{\n  "key": "value",\n  "number": 123\n}');
    });

    it("应该正确格式化JSON数组", () => {
      const data = [1, 2, 3];
      const result = formatJson(data);

      expect(result).toBe("[\n  1,\n  2,\n  3\n]");
    });

    it("应该处理null和undefined", () => {
      expect(formatJson(null)).toBeNull();
      expect(formatJson(undefined)).toBeNull();
    });

    it("应该处理循环引用", () => {
      const obj: any = { name: "test" };
      obj.self = obj;

      const result = formatJson(obj);
      expect(typeof result).toBe("string");
    });

    it("应该处理基本类型", () => {
      expect(formatJson("string")).toBe('"string"');
      expect(formatJson(123)).toBe("123");
      expect(formatJson(true)).toBe("true");
    });
  });

  describe("generateStableKey", () => {
    it("应该生成稳定的键值", () => {
      const log: ToolCallRecord = {
        toolName: "test_tool",
        serverName: "test_server",
        success: true,
        timestamp: 1704067200000,
      };

      const key1 = generateStableKey(log, 0);
      const key2 = generateStableKey(log, 0);

      expect(key1).toBe(key2);
      expect(key1).toBe("test_tool-1704067200000-0");
    });

    it("应该处理缺少时间戳的记录", () => {
      const log: ToolCallRecord = {
        toolName: "test_tool",
        success: true,
      };

      const key = generateStableKey(log, 1);
      expect(key).toMatch(/test_tool-\d+-1/);
    });

    it("应该为不同记录生成不同的键", () => {
      const log1: ToolCallRecord = {
        toolName: "tool1",
        success: true,
        timestamp: 1000,
      };

      const log2: ToolCallRecord = {
        toolName: "tool2",
        success: true,
        timestamp: 1000,
      };

      const key1 = generateStableKey(log1, 0);
      const key2 = generateStableKey(log2, 0);

      expect(key1).not.toBe(key2);
    });

    it("应该处理相同工具名的不同索引", () => {
      const log: ToolCallRecord = {
        toolName: "test_tool",
        success: true,
        timestamp: 1000,
      };

      const key1 = generateStableKey(log, 0);
      const key2 = generateStableKey(log, 1);

      expect(key1).not.toBe(key2);
      expect(key1).toBe("test_tool-1000-0");
      expect(key2).toBe("test_tool-1000-1");
    });
  });

  describe("formatError", () => {
    it("应该正确格式化字符串错误", () => {
      const error = "This is an error message";
      expect(formatError(error)).toBe("This is an error message");
    });

    it("应该正确格式化Error对象", () => {
      const error = new Error("Something went wrong");
      expect(formatError(error)).toBe("Something went wrong");
    });

    it("应该正确格式化对象", () => {
      const error = { code: 500, message: "Server error" };
      expect(formatError(error)).toBe("[object Object]");
    });

    it("应该正确格式化数字", () => {
      expect(formatError(404)).toBe("404");
    });

    it("应该正确格式化null和undefined", () => {
      expect(formatError(null)).toBe("null");
      expect(formatError(undefined)).toBe("undefined");
    });
  });
});
