/**
 * 格式化工具单元测试
 */

import { FormatUtils } from "../FormatUtils";
import { describe, expect, it } from "vitest";

describe("FormatUtils", () => {
  describe("formatUptime", () => {
    it("should format seconds", () => {
      expect(FormatUtils.formatUptime(30000)).toBe("30秒");
    });

    it("should format minutes and seconds", () => {
      expect(FormatUtils.formatUptime(90000)).toBe("1分钟 30秒");
    });

    it("should format hours and minutes", () => {
      expect(FormatUtils.formatUptime(3690000)).toBe("1小时 1分钟");
    });

    it("should format days, hours and minutes", () => {
      expect(FormatUtils.formatUptime(90090000)).toBe("1天 1小时 1分钟");
    });
  });

  describe("formatFileSize", () => {
    it("should format bytes", () => {
      expect(FormatUtils.formatFileSize(512)).toBe("512 B");
    });

    it("should format kilobytes", () => {
      expect(FormatUtils.formatFileSize(1536)).toBe("1.5 KB");
    });

    it("should format megabytes", () => {
      expect(FormatUtils.formatFileSize(1572864)).toBe("1.5 MB");
    });

    it("should format gigabytes", () => {
      expect(FormatUtils.formatFileSize(1610612736)).toBe("1.5 GB");
    });
  });

  describe("formatTimestamp", () => {
    const timestamp = new Date("2024-01-01T12:30:45").getTime();

    it("should format full timestamp", () => {
      const result = FormatUtils.formatTimestamp(timestamp, "full");
      expect(result).toContain("2024");
      expect(result).toContain("12:30:45");
    });

    it("should format date only", () => {
      const result = FormatUtils.formatTimestamp(timestamp, "date");
      expect(result).toContain("2024");
      expect(result).not.toContain("12:30:45");
    });

    it("should format time only", () => {
      const result = FormatUtils.formatTimestamp(timestamp, "time");
      expect(result).toContain("12:30:45");
      expect(result).not.toContain("2024");
    });
  });

  describe("formatPid", () => {
    it("should format process ID", () => {
      expect(FormatUtils.formatPid(1234)).toBe("PID: 1234");
    });
  });

  describe("formatPort", () => {
    it("should format port number", () => {
      expect(FormatUtils.formatPort(3000)).toBe("端口: 3000");
    });
  });

  describe("formatUrl", () => {
    it("should format URL without path", () => {
      const result = FormatUtils.formatUrl("http", "localhost", 3000);
      expect(result).toBe("http://localhost:3000");
    });

    it("should format URL with path", () => {
      const result = FormatUtils.formatUrl(
        "https",
        "example.com",
        443,
        "/api/v1"
      );
      expect(result).toBe("https://example.com:443/api/v1");
    });
  });

  describe("formatConfigPair", () => {
    it("should format string value", () => {
      const result = FormatUtils.formatConfigPair("name", "xiaozhi");
      expect(result).toBe("name: xiaozhi");
    });

    it("should format object value", () => {
      const result = FormatUtils.formatConfigPair("config", { port: 3000 });
      expect(result).toContain("config:");
      expect(result).toContain('"port": 3000');
    });
  });

  describe("formatError", () => {
    it("should format error without stack", () => {
      const error = new Error("Test error");
      const result = FormatUtils.formatError(error);
      expect(result).toBe("错误: Test error");
    });

    it("should format error with stack", () => {
      const error = new Error("Test error");
      const result = FormatUtils.formatError(error, true);
      expect(result).toContain("错误: Test error");
      expect(result).toContain("堆栈信息:");
    });
  });

  describe("formatList", () => {
    it("should format list with default bullet", () => {
      const items = ["item1", "item2", "item3"];
      const result = FormatUtils.formatList(items);
      expect(result).toBe("• item1\n• item2\n• item3");
    });

    it("should format list with custom bullet", () => {
      const items = ["item1", "item2"];
      const result = FormatUtils.formatList(items, "-");
      expect(result).toBe("- item1\n- item2");
    });
  });

  describe("formatTable", () => {
    it("should format empty table", () => {
      const result = FormatUtils.formatTable([]);
      expect(result).toBe("");
    });

    it("should format table with data", () => {
      const data = [
        { name: "Alice", age: 30 },
        { name: "Bob", age: 25 },
      ];
      const result = FormatUtils.formatTable(data);
      expect(result).toContain("name");
      expect(result).toContain("age");
      expect(result).toContain("Alice");
      expect(result).toContain("Bob");
    });
  });

  describe("formatProgressBar", () => {
    it("should format progress bar at 0%", () => {
      const result = FormatUtils.formatProgressBar(0, 100);
      expect(result).toContain("[░░░░░░░░░░░░░░░░░░░░] 0% (0/100)");
    });

    it("should format progress bar at 50%", () => {
      const result = FormatUtils.formatProgressBar(50, 100);
      expect(result).toContain("50% (50/100)");
      expect(result).toContain("█");
      expect(result).toContain("░");
    });

    it("should format progress bar at 100%", () => {
      const result = FormatUtils.formatProgressBar(100, 100);
      expect(result).toContain("[████████████████████] 100% (100/100)");
    });
  });

  describe("formatCommandArgs", () => {
    it("should format command without spaces", () => {
      const result = FormatUtils.formatCommandArgs("node", [
        "script.js",
        "--port",
        "3000",
      ]);
      expect(result).toBe("node script.js --port 3000");
    });

    it("should quote arguments with spaces", () => {
      const result = FormatUtils.formatCommandArgs("node", [
        "my script.js",
        "--name",
        "My App",
      ]);
      expect(result).toBe('node "my script.js" --name "My App"');
    });
  });

  describe("truncateText", () => {
    it("should not truncate short text", () => {
      const result = FormatUtils.truncateText("short", 10);
      expect(result).toBe("short");
    });

    it("should truncate long text", () => {
      const result = FormatUtils.truncateText("this is a very long text", 10);
      expect(result).toBe("this is...");
    });

    it("should use custom suffix", () => {
      const result = FormatUtils.truncateText("long text", 5, "---");
      expect(result).toBe("lo---");
    });
  });

  describe("formatJson", () => {
    it("should format valid object", () => {
      const obj = { name: "test", value: 123 };
      const result = FormatUtils.formatJson(obj);
      expect(result).toContain('"name": "test"');
      expect(result).toContain('"value": 123');
    });

    it("should handle invalid object", () => {
      const circular: any = {};
      circular.self = circular;
      const result = FormatUtils.formatJson(circular);
      expect(result).toBe("[object Object]");
    });
  });

  describe("formatBoolean", () => {
    it("should format true with default text", () => {
      expect(FormatUtils.formatBoolean(true)).toBe("是");
    });

    it("should format false with default text", () => {
      expect(FormatUtils.formatBoolean(false)).toBe("否");
    });

    it("should format with custom text", () => {
      expect(FormatUtils.formatBoolean(true, "Yes", "No")).toBe("Yes");
      expect(FormatUtils.formatBoolean(false, "Yes", "No")).toBe("No");
    });
  });
});
