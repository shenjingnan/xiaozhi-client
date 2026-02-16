/**
 * 类型和枚举单元测试
 */

import { describe, expect, it } from "vitest";
import {
  ConnectionState,
  ensureToolJSONSchema,
  ToolCallError,
  ToolCallErrorCode,
} from "../types.js";

describe("类型和枚举测试", () => {
  describe("ToolCallErrorCode 枚举", () => {
    it("应该定义所有错误码", () => {
      expect(ToolCallErrorCode.INVALID_PARAMS).toBe(-32602);
      expect(ToolCallErrorCode.TOOL_NOT_FOUND).toBe(-32601);
      expect(ToolCallErrorCode.SERVICE_UNAVAILABLE).toBe(-32001);
      expect(ToolCallErrorCode.TIMEOUT).toBe(-32002);
      expect(ToolCallErrorCode.TOOL_EXECUTION_ERROR).toBe(-32000);
    });

    it("错误码应该是负数", () => {
      // 只获取枚举的数值，不包括字符串键
      const values = Object.values(ToolCallErrorCode).filter(
        (v) => typeof v === "number"
      );
      for (const value of values) {
        expect(value).toBeLessThan(0);
      }
    });

    it("错误码应该是唯一的", () => {
      const values = Object.values(ToolCallErrorCode);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });
  });

  describe("ToolCallError 错误类", () => {
    it("应该创建带有错误码和消息的错误", () => {
      const error = new ToolCallError(
        ToolCallErrorCode.INVALID_PARAMS,
        "无效参数"
      );
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("ToolCallError");
      expect(error.code).toBe(ToolCallErrorCode.INVALID_PARAMS);
      expect(error.message).toBe("无效参数");
    });

    it("应该支持可选的 data 字段", () => {
      const data = { field: "value", details: [1, 2, 3] };
      const error = new ToolCallError(
        ToolCallErrorCode.TOOL_EXECUTION_ERROR,
        "工具执行失败",
        data
      );
      expect(error.data).toEqual(data);
    });

    it("默认 data 应该是 undefined", () => {
      const error = new ToolCallError(ToolCallErrorCode.TIMEOUT, "超时");
      expect(error.data).toBeUndefined();
    });

    it("应该正确捕获堆栈信息", () => {
      const error = new ToolCallError(
        ToolCallErrorCode.TOOL_NOT_FOUND,
        "工具不存在"
      );
      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe("string");
    });

    it("应该能够作为 Error 抛出和捕获", () => {
      const error = new ToolCallError(
        ToolCallErrorCode.SERVICE_UNAVAILABLE,
        "服务不可用"
      );

      try {
        throw error;
      } catch (e) {
        expect(e).toBeInstanceOf(ToolCallError);
        expect(e).toBeInstanceOf(Error);
        if (e instanceof ToolCallError) {
          expect(e.code).toBe(ToolCallErrorCode.SERVICE_UNAVAILABLE);
          expect(e.message).toBe("服务不可用");
        }
      }
    });

    it("应该支持不同错误码的错误", () => {
      const errors = [
        new ToolCallError(ToolCallErrorCode.INVALID_PARAMS, "参数错误"),
        new ToolCallError(ToolCallErrorCode.TOOL_NOT_FOUND, "工具不存在"),
        new ToolCallError(ToolCallErrorCode.SERVICE_UNAVAILABLE, "服务不可用"),
        new ToolCallError(ToolCallErrorCode.TIMEOUT, "超时"),
        new ToolCallError(ToolCallErrorCode.TOOL_EXECUTION_ERROR, "执行错误"),
      ];

      for (const error of errors) {
        expect(error).toBeInstanceOf(ToolCallError);
        expect(error.name).toBe("ToolCallError");
        expect(error.message).toBeDefined();
        expect(typeof error.code).toBe("number");
      }
    });
  });

  describe("ConnectionState 枚举", () => {
    it("应该定义所有连接状态", () => {
      expect(ConnectionState.DISCONNECTED).toBe("disconnected");
      expect(ConnectionState.CONNECTING).toBe("connecting");
      expect(ConnectionState.CONNECTED).toBe("connected");
      expect(ConnectionState.FAILED).toBe("failed");
    });

    it("连接状态应该是字符串", () => {
      const values = Object.values(ConnectionState);
      for (const value of values) {
        expect(typeof value).toBe("string");
      }
    });

    it("连接状态应该是唯一的", () => {
      const values = Object.values(ConnectionState);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });

    it("应该包含标准状态", () => {
      expect(ConnectionState.DISCONNECTED).toBeDefined();
      expect(ConnectionState.CONNECTING).toBeDefined();
      expect(ConnectionState.CONNECTED).toBeDefined();
      expect(ConnectionState.FAILED).toBeDefined();
    });
  });

  describe("ensureToolJSONSchema 函数", () => {
    it("应该正确处理有效的 object schema", () => {
      const schema = {
        type: "object" as const,
        properties: { name: { type: "string" } },
        required: ["name"],
        additionalProperties: false,
      };
      const result = ensureToolJSONSchema(schema);
      expect(result.type).toBe("object");
      expect(result.properties).toEqual({ name: { type: "string" } });
      expect(result.required).toEqual(["name"]);
      expect(result.additionalProperties).toBe(false);
    });

    it("应该为非标准格式返回默认 schema", () => {
      const schema = { foo: "bar" };
      const result = ensureToolJSONSchema(schema);
      expect(result).toEqual({
        type: "object",
        properties: {},
        required: [],
        additionalProperties: true,
      });
    });

    it("应该处理只有 type 字段的 schema", () => {
      const schema = {
        type: "object" as const,
      };
      const result = ensureToolJSONSchema(schema);
      expect(result.type).toBe("object");
      expect(result.properties).toBeUndefined();
      expect(result.required).toBeUndefined();
    });

    it("应该处理完整的 object schema", () => {
      const schema = {
        type: "object" as const,
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
        required: ["name", "age"],
        additionalProperties: true,
      };
      const result = ensureToolJSONSchema(schema);
      expect(result).toEqual(schema);
    });

    it("应该处理空对象", () => {
      const schema = {};
      const result = ensureToolJSONSchema(schema);
      expect(result).toEqual({
        type: "object",
        properties: {},
        required: [],
        additionalProperties: true,
      });
    });

    it("应该处理 null", () => {
      const result = ensureToolJSONSchema(null as any);
      expect(result).toEqual({
        type: "object",
        properties: {},
        required: [],
        additionalProperties: true,
      });
    });

    it("应该处理数组", () => {
      const result = ensureToolJSONSchema([] as any);
      expect(result).toEqual({
        type: "object",
        properties: {},
        required: [],
        additionalProperties: true,
      });
    });

    it("应该处理不同 type 的 schema", () => {
      const stringSchema = { type: "string" };
      const result = ensureToolJSONSchema(stringSchema);
      expect(result).toEqual({
        type: "object",
        properties: {},
        required: [],
        additionalProperties: true,
      });
    });

    it("应该保留符合标准的复杂 schema", () => {
      const schema = {
        type: "object" as const,
        properties: {
          user: {
            type: "object",
            properties: {
              name: { type: "string" },
              email: { type: "string" },
            },
            required: ["name"],
          },
        },
        required: ["user"],
      };
      const result = ensureToolJSONSchema(schema);
      expect(result).toEqual(schema);
    });
  });

  describe("类型兼容性", () => {
    it("ToolCallError 应该可以赋值给 Error", () => {
      const error: Error = new ToolCallError(ToolCallErrorCode.TIMEOUT, "超时");
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("超时");
    });

    it("ConnectionState 应该可以用作字符串", () => {
      const state: string = ConnectionState.CONNECTED;
      expect(state).toBe("connected");
    });

    it("ToolCallErrorCode 应该可以用作数字", () => {
      const code: number = ToolCallErrorCode.INVALID_PARAMS;
      expect(code).toBe(-32602);
    });
  });

  describe("枚举值验证", () => {
    it("ToolCallErrorCode 应该有合理的值范围", () => {
      const values = Object.values(ToolCallErrorCode);
      expect(values.length).toBeGreaterThan(0);
      expect(values.length).toBeLessThan(100);
    });

    it("ConnectionState 应该有合理的值范围", () => {
      const values = Object.values(ConnectionState);
      expect(values.length).toBeGreaterThan(0);
      expect(values.length).toBeLessThan(20);
    });
  });
});
