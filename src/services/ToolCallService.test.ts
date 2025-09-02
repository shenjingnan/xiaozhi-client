/**
 * ToolCallService 测试
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToolCallService } from "./ToolCallService.js";

describe("ToolCallService", () => {
  let toolCallService: ToolCallService;

  beforeEach(() => {
    toolCallService = new ToolCallService();
  });

  describe("parseJsonArgs", () => {
    it("应该正确解析有效的 JSON 字符串", () => {
      const jsonString = '{"a": 10, "b": 20}';
      const result = toolCallService.parseJsonArgs(jsonString);
      expect(result).toEqual({ a: 10, b: 20 });
    });

    it("应该正确解析空对象", () => {
      const jsonString = "{}";
      const result = toolCallService.parseJsonArgs(jsonString);
      expect(result).toEqual({});
    });

    it("应该正确解析复杂的 JSON 对象", () => {
      const jsonString =
        '{"user": {"name": "test", "age": 25}, "items": [1, 2, 3]}';
      const result = toolCallService.parseJsonArgs(jsonString);
      expect(result).toEqual({
        user: { name: "test", age: 25 },
        items: [1, 2, 3],
      });
    });

    it("应该在 JSON 格式错误时抛出错误", () => {
      const invalidJson = "invalid-json";
      expect(() => toolCallService.parseJsonArgs(invalidJson)).toThrow(
        "参数格式错误，请使用有效的 JSON 格式"
      );
    });

    it("应该在 JSON 语法错误时抛出错误", () => {
      const invalidJson = '{"a": 10, "b":}';
      expect(() => toolCallService.parseJsonArgs(invalidJson)).toThrow(
        "参数格式错误，请使用有效的 JSON 格式"
      );
    });
  });

  describe("formatOutput", () => {
    it("应该正确格式化工具调用结果", () => {
      const result = {
        content: [
          {
            type: "text",
            text: "30",
          },
        ],
      };

      const formatted = toolCallService.formatOutput(result);
      const expected = JSON.stringify(result, null, 2);
      expect(formatted).toBe(expected);
    });

    it("应该正确格式化包含错误的结果", () => {
      const result = {
        content: [
          {
            type: "text",
            text: "Error occurred",
          },
        ],
        isError: true,
      };

      const formatted = toolCallService.formatOutput(result);
      const expected = JSON.stringify(result, null, 2);
      expect(formatted).toBe(expected);
    });

    it("应该正确格式化复杂的结果对象", () => {
      const result = {
        content: [
          {
            type: "text",
            text: "Result 1",
          },
          {
            type: "json",
            text: '{"data": "value"}',
          },
        ],
      };

      const formatted = toolCallService.formatOutput(result);
      const expected = JSON.stringify(result, null, 2);
      expect(formatted).toBe(expected);
    });
  });

  describe("getServiceStatus", () => {
    it("应该在服务未初始化时返回正确状态", async () => {
      const status = await toolCallService.getServiceStatus();
      expect(status).toBe("服务未启动");
    });
  });
});
