import { describe, expect, it } from "vitest";
import { isToolCallResult } from "../mcp.js";

describe("isToolCallResult 类型守卫", () => {
  // =========================
  // 有效结果
  // =========================

  describe("有效工具调用结果", () => {
    it("标准文本内容应返回 true", () => {
      const result = {
        content: [{ type: "text", text: "hello" }],
      };

      expect(isToolCallResult(result)).toBe(true);
    });

    it("多段文本内容应返回 true", () => {
      const result = {
        content: [
          { type: "text", text: "first" },
          { type: "text", text: "second" },
        ],
      };

      expect(isToolCallResult(result)).toBe(true);
    });

    it("包含 isError 字段的错误结果应返回 true", () => {
      const result = {
        content: [{ type: "text", text: "error msg" }],
        isError: true,
      };

      expect(isToolCallResult(result)).toBe(true);
    });

    it("包含额外扩展字段的结果应返回 true", () => {
      const result = {
        content: [{ type: "text", text: "ok" }],
        customField: "value",
        metadata: { id: 123 },
      };

      expect(isToolCallResult(result)).toBe(true);
    });
  });

  // =========================
  // 无效结果
  // =========================

  describe("无效输入", () => {
    it("null 应返回 false", () => {
      expect(isToolCallResult(null)).toBe(false);
    });

    it("undefined 应返回 false", () => {
      expect(isToolCallResult(undefined)).toBe(false);
    });

    it("字符串应返回 false", () => {
      expect(isToolCallResult("not an object")).toBe(false);
    });

    it("数字应返回 false", () => {
      expect(isToolCallResult(42)).toBe(false);
    });

    it("布尔值应返回 false", () => {
      expect(isToolCallResult(true)).toBe(false);
    });

    it("空对象（无 content 字段）应返回 false", () => {
      expect(isToolCallResult({})).toBe(false);
    });

    it("content 为非数组值应返回 false", () => {
      expect(isToolCallResult({ content: "not-array" })).toBe(false);
    });

    it("content 为空数组应返回 false", () => {
      expect(isToolCallResult({ content: [] })).toBe(false);
    });

    it("content 中元素缺少 type 字段应返回 false", () => {
      expect(
        isToolCallResult({
          content: [{ text: "no type field" }],
        })
      ).toBe(false);
    });

    it("content 中元素 type 非 text 应返回 false", () => {
      expect(
        isToolCallResult({
          content: [{ type: "image", data: "abc" }],
        })
      ).toBe(false);
    });

    it("content 中元素 text 非字符串应返回 false", () => {
      expect(
        isToolCallResult({
          content: [{ type: "text", text: 123 }],
        })
      ).toBe(false);
    });
  });

  // =========================
  // 边界场景
  // =========================

  describe("边界场景", () => {
    it("content 为 undefined 但有其他字段应返回 false", () => {
      const result = { content: undefined } as unknown;

      expect(isToolCallResult(result)).toBe(false);
    });

    it("content 缺失但存在其他字段应返回 false", () => {
      const result = { isError: false, other: "value" } as unknown;

      expect(isToolCallResult(result)).toBe(false);
    });

    it("空数组 content 的对象应返回 false", () => {
      expect(isToolCallResult({ content: [] })).toBe(false);
    });

    it("text 为空字符串的有效结构应返回 true", () => {
      expect(
        isToolCallResult({
          content: [{ type: "text", text: "" }],
        })
      ).toBe(true);
    });
  });
});
