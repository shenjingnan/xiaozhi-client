/**
 * 输入验证工具单元测试
 */

import { describe, expect, it } from "vitest";
import { ValidationError } from "../errors/index.js";
import { Validation } from "./Validation.js";

describe("Validation", () => {
  describe("validatePort", () => {
    it("should accept valid port numbers", () => {
      expect(() => Validation.validatePort(80)).not.toThrow();
      expect(() => Validation.validatePort(8080)).not.toThrow();
      expect(() => Validation.validatePort(65535)).not.toThrow();
    });

    it("should reject non-integer port numbers", () => {
      expect(() => Validation.validatePort(80.5)).toThrow(ValidationError);
      expect(() => Validation.validatePort(Number.NaN)).toThrow(
        ValidationError
      );
    });

    it("should reject port numbers less than 1", () => {
      expect(() => Validation.validatePort(0)).toThrow(ValidationError);
      expect(() => Validation.validatePort(-1)).toThrow(ValidationError);
    });

    it("should reject port numbers greater than 65535", () => {
      expect(() => Validation.validatePort(65536)).toThrow(ValidationError);
      expect(() => Validation.validatePort(99999)).toThrow(ValidationError);
    });

    it("should throw ValidationError with correct message", () => {
      expect(() => Validation.validatePort(99999)).toThrow(
        "端口号必须在 1-65535 范围内"
      );
    });
  });

  describe("validateConfigFormat", () => {
    it("should accept valid config formats", () => {
      expect(Validation.validateConfigFormat("json")).toBe("json");
      expect(Validation.validateConfigFormat("json5")).toBe("json5");
      expect(Validation.validateConfigFormat("jsonc")).toBe("jsonc");
    });

    it("should reject invalid config formats", () => {
      expect(() => Validation.validateConfigFormat("xml")).toThrow(
        ValidationError
      );
      expect(() => Validation.validateConfigFormat("yaml")).toThrow(
        ValidationError
      );
      expect(() => Validation.validateConfigFormat("")).toThrow(
        ValidationError
      );
    });

    it("should throw ValidationError with correct message", () => {
      expect(() => Validation.validateConfigFormat("invalid")).toThrow(
        "无效的配置文件格式: invalid，支持的格式: json, json5, jsonc"
      );
    });
  });

  describe("validateRequired", () => {
    it("should accept non-null, non-undefined, non-empty values", () => {
      expect(() => Validation.validateRequired("value", "field")).not.toThrow();
      expect(() => Validation.validateRequired(0, "field")).not.toThrow();
      expect(() => Validation.validateRequired(false, "field")).not.toThrow();
      expect(() => Validation.validateRequired([], "field")).not.toThrow();
      expect(() => Validation.validateRequired({}, "field")).not.toThrow();
    });

    it("should reject undefined values", () => {
      expect(() => Validation.validateRequired(undefined, "field")).toThrow(
        ValidationError
      );
    });

    it("should reject null values", () => {
      expect(() => Validation.validateRequired(null, "field")).toThrow(
        ValidationError
      );
    });

    it("should reject empty strings", () => {
      expect(() => Validation.validateRequired("", "field")).toThrow(
        ValidationError
      );
    });

    it("should throw ValidationError with correct field name", () => {
      expect(() => Validation.validateRequired(undefined, "testField")).toThrow(
        "验证失败: testField - 必填字段不能为空"
      );
    });
  });

  describe("validateStringLength", () => {
    it("should accept strings within length range", () => {
      expect(() =>
        Validation.validateStringLength("hello", "field", { min: 3, max: 10 })
      ).not.toThrow();
      expect(() =>
        Validation.validateStringLength("hello", "field", { min: 5 })
      ).not.toThrow();
      expect(() =>
        Validation.validateStringLength("hello", "field", { max: 10 })
      ).not.toThrow();
      expect(() =>
        Validation.validateStringLength("hello", "field")
      ).not.toThrow();
    });

    it("should reject strings shorter than minimum", () => {
      expect(() =>
        Validation.validateStringLength("hi", "field", { min: 3 })
      ).toThrow(ValidationError);
    });

    it("should reject strings longer than maximum", () => {
      expect(() =>
        Validation.validateStringLength("verylongstring", "field", { max: 5 })
      ).toThrow(ValidationError);
    });

    it("should throw ValidationError with correct message", () => {
      expect(() =>
        Validation.validateStringLength("hi", "field", { min: 3 })
      ).toThrow("长度不能少于 3 个字符，当前长度: 2");
      expect(() =>
        Validation.validateStringLength("verylongstring", "field", { max: 5 })
      ).toThrow("长度不能超过 5 个字符，当前长度: 14");
    });
  });

  describe("validateUrl", () => {
    it("should accept valid URLs", () => {
      expect(() => Validation.validateUrl("http://example.com")).not.toThrow();
      expect(() => Validation.validateUrl("https://example.com")).not.toThrow();
      expect(() =>
        Validation.validateUrl("http://localhost:8080")
      ).not.toThrow();
      expect(() =>
        Validation.validateUrl("https://example.com/path?query=value")
      ).not.toThrow();
    });

    it("should reject invalid URLs", () => {
      expect(() => Validation.validateUrl("not-a-url")).toThrow(
        ValidationError
      );
      expect(() => Validation.validateUrl("http://")).toThrow(ValidationError);
      expect(() => Validation.validateUrl("")).toThrow(ValidationError);
    });

    it("should throw ValidationError with correct field name", () => {
      expect(() => Validation.validateUrl("invalid", "testField")).toThrow(
        "无效的 URL 格式: invalid"
      );
    });
  });

  describe("validateWebSocketUrl", () => {
    it("should accept valid WebSocket URLs", () => {
      expect(() =>
        Validation.validateWebSocketUrl("ws://example.com")
      ).not.toThrow();
      expect(() =>
        Validation.validateWebSocketUrl("wss://example.com")
      ).not.toThrow();
      expect(() =>
        Validation.validateWebSocketUrl("ws://localhost:8080")
      ).not.toThrow();
    });

    it("should reject non-WebSocket URLs", () => {
      expect(() =>
        Validation.validateWebSocketUrl("http://example.com")
      ).toThrow(ValidationError);
      expect(() =>
        Validation.validateWebSocketUrl("https://example.com")
      ).toThrow(ValidationError);
      expect(() =>
        Validation.validateWebSocketUrl("ftp://example.com")
      ).toThrow(ValidationError);
    });

    it("should reject invalid WebSocket URLs", () => {
      expect(() => Validation.validateWebSocketUrl("ws://")).toThrow(
        ValidationError
      );
      expect(() => Validation.validateWebSocketUrl("wss://")).toThrow(
        ValidationError
      );
    });

    it("should throw ValidationError with correct protocol message", () => {
      expect(() =>
        Validation.validateWebSocketUrl("http://example.com")
      ).toThrow("WebSocket URL 必须使用 ws:// 或 wss:// 协议，当前协议: http:");
    });
  });

  describe("validateHttpUrl", () => {
    it("should accept valid HTTP URLs", () => {
      expect(() =>
        Validation.validateHttpUrl("http://example.com")
      ).not.toThrow();
      expect(() =>
        Validation.validateHttpUrl("https://example.com")
      ).not.toThrow();
      expect(() =>
        Validation.validateHttpUrl("http://localhost:8080")
      ).not.toThrow();
    });

    it("should reject non-HTTP URLs", () => {
      expect(() => Validation.validateHttpUrl("ws://example.com")).toThrow(
        ValidationError
      );
      expect(() => Validation.validateHttpUrl("wss://example.com")).toThrow(
        ValidationError
      );
      expect(() => Validation.validateHttpUrl("ftp://example.com")).toThrow(
        ValidationError
      );
    });

    it("should reject invalid HTTP URLs", () => {
      expect(() => Validation.validateHttpUrl("http://")).toThrow(
        ValidationError
      );
      expect(() => Validation.validateHttpUrl("https://")).toThrow(
        ValidationError
      );
    });

    it("should throw ValidationError with correct protocol message", () => {
      expect(() => Validation.validateHttpUrl("ws://example.com")).toThrow(
        "HTTP URL 必须使用 http:// 或 https:// 协议，当前协议: ws:"
      );
    });
  });

  describe("validateProjectName", () => {
    it("should accept valid project names", () => {
      expect(() => Validation.validateProjectName("my-project")).not.toThrow();
      expect(() => Validation.validateProjectName("my_project")).not.toThrow();
      expect(() => Validation.validateProjectName("myproject")).not.toThrow();
      expect(() =>
        Validation.validateProjectName("MyProject123")
      ).not.toThrow();
    });

    it("should reject project names with invalid characters", () => {
      expect(() => Validation.validateProjectName("my<project")).toThrow(
        ValidationError
      );
      expect(() => Validation.validateProjectName("my>project")).toThrow(
        ValidationError
      );
      expect(() => Validation.validateProjectName('my:"project"')).toThrow(
        ValidationError
      );
      expect(() => Validation.validateProjectName("my/project")).toThrow(
        ValidationError
      );
      expect(() => Validation.validateProjectName("my\\project")).toThrow(
        ValidationError
      );
      expect(() => Validation.validateProjectName("my|project")).toThrow(
        ValidationError
      );
      expect(() => Validation.validateProjectName("my?project")).toThrow(
        ValidationError
      );
      expect(() => Validation.validateProjectName("my*project")).toThrow(
        ValidationError
      );
    });

    it("should reject project names with control characters", () => {
      expect(() => Validation.validateProjectName("my\u0000project")).toThrow(
        ValidationError
      );
      expect(() => Validation.validateProjectName("my\u0001project")).toThrow(
        ValidationError
      );
    });

    it("should reject project names starting with dot", () => {
      expect(() => Validation.validateProjectName(".myproject")).toThrow(
        ValidationError
      );
    });

    it("should reject project names that are too short or too long", () => {
      expect(() => Validation.validateProjectName("")).toThrow(ValidationError);
      const longName = "a".repeat(101);
      expect(() => Validation.validateProjectName(longName)).toThrow(
        ValidationError
      );
    });
  });

  describe("validateTemplateName", () => {
    it("should accept valid template names", () => {
      expect(() =>
        Validation.validateTemplateName("hello-world")
      ).not.toThrow();
      expect(() =>
        Validation.validateTemplateName("hello_world")
      ).not.toThrow();
      expect(() => Validation.validateTemplateName("HelloWorld")).not.toThrow();
      expect(() => Validation.validateTemplateName("hello123")).not.toThrow();
      expect(() => Validation.validateTemplateName("h")).not.toThrow();
    });

    it("should reject template names with invalid characters", () => {
      expect(() => Validation.validateTemplateName("hello.world")).toThrow(
        ValidationError
      );
      expect(() => Validation.validateTemplateName("hello$world")).toThrow(
        ValidationError
      );
      expect(() => Validation.validateTemplateName("hello world")).toThrow(
        ValidationError
      );
      expect(() => Validation.validateTemplateName("hello@world")).toThrow(
        ValidationError
      );
    });

    it("should reject template names that are too short or too long", () => {
      expect(() => Validation.validateTemplateName("")).toThrow(
        ValidationError
      );
      const longName = "a".repeat(51);
      expect(() => Validation.validateTemplateName(longName)).toThrow(
        ValidationError
      );
    });
  });

  describe("validateEnvVarName", () => {
    it("should accept valid environment variable names", () => {
      expect(() => Validation.validateEnvVarName("VAR_NAME")).not.toThrow();
      expect(() => Validation.validateEnvVarName("VAR123")).not.toThrow();
      expect(() => Validation.validateEnvVarName("_VAR_NAME")).not.toThrow();
      expect(() => Validation.validateEnvVarName("VAR_")).not.toThrow();
      expect(() => Validation.validateEnvVarName("V")).not.toThrow();
    });

    it("should reject environment variable names with invalid characters", () => {
      expect(() => Validation.validateEnvVarName("var_name")).toThrow(
        ValidationError
      );
      expect(() => Validation.validateEnvVarName("VAR-NAME")).toThrow(
        ValidationError
      );
      expect(() => Validation.validateEnvVarName("VAR.NAME")).toThrow(
        ValidationError
      );
      expect(() => Validation.validateEnvVarName("VAR NAME")).toThrow(
        ValidationError
      );
    });

    it("should reject environment variable names starting with numbers", () => {
      expect(() => Validation.validateEnvVarName("1VAR_NAME")).toThrow(
        ValidationError
      );
      expect(() => Validation.validateEnvVarName("123VAR")).toThrow(
        ValidationError
      );
    });

    it("should reject empty environment variable names", () => {
      expect(() => Validation.validateEnvVarName("")).toThrow(ValidationError);
    });
  });

  describe("validateJson", () => {
    it("should accept valid JSON", () => {
      const validJson = '{"key": "value", "number": 42}';
      const result = Validation.validateJson(validJson);
      expect(result).toEqual({ key: "value", number: 42 });
    });

    it("should reject invalid JSON", () => {
      expect(() => Validation.validateJson('{"key": "value"')).toThrow(
        ValidationError
      );
      expect(() => Validation.validateJson("not json")).toThrow(
        ValidationError
      );
      expect(() => Validation.validateJson("")).toThrow(ValidationError);
    });

    it("should throw ValidationError with correct message", () => {
      expect(() => Validation.validateJson('{"key": "value"')).toThrow(
        ValidationError
      );
      expect(() => Validation.validateJson('{"key": "value"')).toThrow(
        "无效的 JSON 格式"
      );
    });
  });

  describe("validateNumberRange", () => {
    it("should accept numbers within range", () => {
      expect(() =>
        Validation.validateNumberRange(5, "field", { min: 0, max: 10 })
      ).not.toThrow();
      expect(() =>
        Validation.validateNumberRange(5, "field", { min: 5 })
      ).not.toThrow();
      expect(() =>
        Validation.validateNumberRange(5, "field", { max: 10 })
      ).not.toThrow();
      expect(() => Validation.validateNumberRange(5, "field")).not.toThrow();
    });

    it("should reject numbers below minimum", () => {
      expect(() =>
        Validation.validateNumberRange(-1, "field", { min: 0 })
      ).toThrow(ValidationError);
    });

    it("should reject numbers above maximum", () => {
      expect(() =>
        Validation.validateNumberRange(11, "field", { max: 10 })
      ).toThrow(ValidationError);
    });

    it("should throw ValidationError with correct message", () => {
      expect(() =>
        Validation.validateNumberRange(-1, "field", { min: 0 })
      ).toThrow("值不能小于 0，当前值: -1");
      expect(() =>
        Validation.validateNumberRange(11, "field", { max: 10 })
      ).toThrow("值不能大于 10，当前值: 11");
    });
  });

  describe("validateArrayLength", () => {
    it("should accept arrays within length range", () => {
      expect(() =>
        Validation.validateArrayLength([1, 2, 3], "field", { min: 1, max: 10 })
      ).not.toThrow();
      expect(() =>
        Validation.validateArrayLength([1, 2, 3], "field", { min: 3 })
      ).not.toThrow();
      expect(() =>
        Validation.validateArrayLength([1, 2, 3], "field", { max: 10 })
      ).not.toThrow();
      expect(() =>
        Validation.validateArrayLength([1, 2, 3], "field")
      ).not.toThrow();
    });

    it("should reject arrays shorter than minimum", () => {
      expect(() =>
        Validation.validateArrayLength([1, 2], "field", { min: 3 })
      ).toThrow(ValidationError);
    });

    it("should reject arrays longer than maximum", () => {
      expect(() =>
        Validation.validateArrayLength([1, 2, 3, 4], "field", { max: 3 })
      ).toThrow(ValidationError);
    });

    it("should throw ValidationError with correct message", () => {
      expect(() =>
        Validation.validateArrayLength([1, 2], "field", { min: 3 })
      ).toThrow("数组长度不能少于 3，当前长度: 2");
      expect(() =>
        Validation.validateArrayLength([1, 2, 3, 4], "field", { max: 3 })
      ).toThrow("数组长度不能超过 3，当前长度: 4");
    });
  });

  describe("validateObjectProperties", () => {
    it("should accept objects with all required properties", () => {
      const obj = { name: "test", age: 25, city: "NYC" };
      expect(() =>
        Validation.validateObjectProperties(obj, ["name", "age"])
      ).not.toThrow();
    });

    it("should reject objects missing required properties", () => {
      const obj = { name: "test" };
      expect(() =>
        Validation.validateObjectProperties(obj, ["name", "age"])
      ).toThrow(ValidationError);
    });

    it("should throw ValidationError with correct message", () => {
      const obj = { name: "test" };
      expect(() =>
        Validation.validateObjectProperties(obj, ["name", "age"])
      ).toThrow("缺少必需的属性: age");
    });
  });

  describe("validateEnum", () => {
    it("should accept valid enum values", () => {
      const validValues = ["option1", "option2", "option3"] as const;
      expect(
        Validation.validateEnum("option1", [...validValues] as const, "field")
      ).toBe("option1");
      expect(
        Validation.validateEnum("option2", [...validValues] as const, "field")
      ).toBe("option2");
    });

    it("should reject invalid enum values", () => {
      const validValues = ["option1", "option2", "option3"] as const;
      expect(() =>
        Validation.validateEnum("invalid", [...validValues] as const, "field")
      ).toThrow(ValidationError);
    });

    it("should throw ValidationError with correct message", () => {
      const validValues = ["option1", "option2", "option3"] as const;
      expect(() =>
        Validation.validateEnum("invalid", [...validValues] as const, "field")
      ).toThrow("无效的值: invalid，有效值: option1, option2, option3");
    });
  });

  describe("validateRegex", () => {
    it("should accept valid regular expressions", () => {
      const result1 = Validation.validateRegex("^test$", "regex");
      expect(result1).toBeInstanceOf(RegExp);

      const result2 = Validation.validateRegex("\\d+", "regex");
      expect(result2).toBeInstanceOf(RegExp);
    });

    it("should reject invalid regular expressions", () => {
      expect(() => Validation.validateRegex("[invalid", "regex")).toThrow(
        ValidationError
      );
      expect(() => Validation.validateRegex("*invalid", "regex")).toThrow(
        ValidationError
      );
    });

    it("should throw ValidationError with correct message", () => {
      expect(() => Validation.validateRegex("[invalid", "regex")).toThrow(
        "无效的正则表达式"
      );
    });
  });
});
