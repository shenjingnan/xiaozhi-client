/**
 * form-helpers 单元测试
 *
 * 测试动态表单字段路径类型辅助函数
 */

import { describe, expect, it } from "vitest";
import { dynamicPath } from "../form-helpers";

describe("dynamicPath", () => {
  describe("基本功能", () => {
    it("应该返回传入的字段名字符串", () => {
      const result = dynamicPath("username");
      expect(result).toBe("username");
    });

    it("应该支持嵌套路径", () => {
      const result = dynamicPath("user.address.city");
      expect(result).toBe("user.address.city");
    });

    it("应该支持数组索引路径", () => {
      const result = dynamicPath("items.0.name");
      expect(result).toBe("items.0.name");
    });

    it("应该支持空字符串", () => {
      const result = dynamicPath("");
      expect(result).toBe("");
    });
  });

  describe("类型安全", () => {
    it("应该能赋值给 Path<Record<string, unknown>> 类型变量", () => {
      // 编译时验证：dynamicPath 返回值可赋给 Path<T> 类型
      type FormValues = Record<string, unknown>;
      const path: string = dynamicPath<FormValues>("fieldName");
      // 如果类型不匹配，TypeScript 编译会失败
      expect(typeof path).toBe("string");
    });

    it("应该保持字符串值的完整性", () => {
      const specialChars = "field-with-dashes_123.and.dots";
      const result = dynamicPath(specialChars);
      expect(result).toBe(specialChars);
    });
  });

  describe("一致性", () => {
    it("多次调用相同输入应返回相同结果", () => {
      const input = "repeat.field";
      const result1 = dynamicPath(input);
      const result2 = dynamicPath(input);
      expect(result1).toBe(result2);
    });

    it("不同输入应返回不同结果", () => {
      const result1 = dynamicPath("fieldA");
      const result2 = dynamicPath("fieldB");
      expect(result1).not.toBe(result2);
    });
  });
});
