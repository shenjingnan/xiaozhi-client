/**
 * 输入验证工具单元测试
 */

import { ValidationError } from "../../errors/index";
import { Validation } from "../Validation";
import { describe, expect, it } from "vitest";

describe("Validation", () => {
  describe("验证端口号", () => {
    it("应接受有效的端口号", () => {
      expect(() => Validation.validatePort(80)).not.toThrow();
      expect(() => Validation.validatePort(8080)).not.toThrow();
      expect(() => Validation.validatePort(65535)).not.toThrow();
    });

    it("应拒绝非整数端口号", () => {
      expect(() => Validation.validatePort(80.5)).toThrow(ValidationError);
      expect(() => Validation.validatePort(Number.NaN)).toThrow(
        ValidationError
      );
    });

    it("应拒绝小于1的端口号", () => {
      expect(() => Validation.validatePort(0)).toThrow(ValidationError);
      expect(() => Validation.validatePort(-1)).toThrow(ValidationError);
    });

    it("应拒绝大于65535的端口号", () => {
      expect(() => Validation.validatePort(65536)).toThrow(ValidationError);
      expect(() => Validation.validatePort(99999)).toThrow(ValidationError);
    });

    it("应抛出带有正确消息的验证错误", () => {
      expect(() => Validation.validatePort(99999)).toThrow(
        "端口号必须在 1-65535 范围内"
      );
    });
  });

  describe("验证配置格式", () => {
    it("应接受有效的配置格式", () => {
      expect(Validation.validateConfigFormat("json")).toBe("json");
      expect(Validation.validateConfigFormat("json5")).toBe("json5");
      expect(Validation.validateConfigFormat("jsonc")).toBe("jsonc");
    });

    it("应拒绝无效的配置格式", () => {
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

    it("应抛出带有正确消息的验证错误", () => {
      expect(() => Validation.validateConfigFormat("invalid")).toThrow(
        "无效的配置文件格式: invalid，支持的格式: json, json5, jsonc"
      );
    });
  });

  describe("验证必填字段", () => {
    it("应接受非null、非undefined、非空值", () => {
      expect(() => Validation.validateRequired("value", "field")).not.toThrow();
      expect(() => Validation.validateRequired(0, "field")).not.toThrow();
      expect(() => Validation.validateRequired(false, "field")).not.toThrow();
      expect(() => Validation.validateRequired([], "field")).not.toThrow();
      expect(() => Validation.validateRequired({}, "field")).not.toThrow();
    });

    it("应拒绝undefined值", () => {
      expect(() => Validation.validateRequired(undefined, "field")).toThrow(
        ValidationError
      );
    });

    it("应拒绝null值", () => {
      expect(() => Validation.validateRequired(null, "field")).toThrow(
        ValidationError
      );
    });

    it("应拒绝空字符串", () => {
      expect(() => Validation.validateRequired("", "field")).toThrow(
        ValidationError
      );
    });

    it("应抛出带有正确字段名的验证错误", () => {
      expect(() => Validation.validateRequired(undefined, "testField")).toThrow(
        "验证失败: testField - 必填字段不能为空"
      );
    });
  });

  describe("验证字符串长度", () => {
    it("应接受长度范围内的字符串", () => {
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

    it("应拒绝短于最小长度的字符串", () => {
      expect(() =>
        Validation.validateStringLength("hi", "field", { min: 3 })
      ).toThrow(ValidationError);
    });

    it("应拒绝长于最大长度的字符串", () => {
      expect(() =>
        Validation.validateStringLength("verylongstring", "field", { max: 5 })
      ).toThrow(ValidationError);
    });

    it("应抛出带有正确消息的验证错误", () => {
      expect(() =>
        Validation.validateStringLength("hi", "field", { min: 3 })
      ).toThrow("长度不能少于 3 个字符，当前长度: 2");
      expect(() =>
        Validation.validateStringLength("verylongstring", "field", { max: 5 })
      ).toThrow("长度不能超过 5 个字符，当前长度: 14");
    });
  });

  describe("验证URL", () => {
    it("应接受有效的URL", () => {
      expect(() => Validation.validateUrl("http://example.com")).not.toThrow();
      expect(() => Validation.validateUrl("https://example.com")).not.toThrow();
      expect(() =>
        Validation.validateUrl("http://localhost:8080")
      ).not.toThrow();
      expect(() =>
        Validation.validateUrl("https://example.com/path?query=value")
      ).not.toThrow();
    });

    it("应拒绝无效的URL", () => {
      expect(() => Validation.validateUrl("not-a-url")).toThrow(
        ValidationError
      );
      expect(() => Validation.validateUrl("http://")).toThrow(ValidationError);
      expect(() => Validation.validateUrl("")).toThrow(ValidationError);
    });

    it("应抛出带有正确字段名的验证错误", () => {
      expect(() => Validation.validateUrl("invalid", "testField")).toThrow(
        "无效的 URL 格式: invalid"
      );
    });
  });

  describe("验证WebSocket URL", () => {
    it("应接受有效的WebSocket URL", () => {
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

    it("应拒绝非WebSocket URL", () => {
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

    it("应拒绝无效的WebSocket URL", () => {
      expect(() => Validation.validateWebSocketUrl("ws://")).toThrow(
        ValidationError
      );
      expect(() => Validation.validateWebSocketUrl("wss://")).toThrow(
        ValidationError
      );
    });

    it("应抛出带有正确协议消息的验证错误", () => {
      expect(() =>
        Validation.validateWebSocketUrl("http://example.com")
      ).toThrow("WebSocket URL 必须使用 ws:// 或 wss:// 协议，当前协议: http:");
    });
  });

  describe("验证HTTP URL", () => {
    it("应接受有效的HTTP URL", () => {
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

    it("应拒绝非HTTP URL", () => {
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

    it("应拒绝无效的HTTP URL", () => {
      expect(() => Validation.validateHttpUrl("http://")).toThrow(
        ValidationError
      );
      expect(() => Validation.validateHttpUrl("https://")).toThrow(
        ValidationError
      );
    });

    it("应抛出带有正确协议消息的验证错误", () => {
      expect(() => Validation.validateHttpUrl("ws://example.com")).toThrow(
        "HTTP URL 必须使用 http:// 或 https:// 协议，当前协议: ws:"
      );
    });
  });

  describe("验证项目名称", () => {
    it("应接受有效的项目名称", () => {
      expect(() => Validation.validateProjectName("my-project")).not.toThrow();
      expect(() => Validation.validateProjectName("my_project")).not.toThrow();
      expect(() => Validation.validateProjectName("myproject")).not.toThrow();
      expect(() =>
        Validation.validateProjectName("MyProject123")
      ).not.toThrow();
    });

    it("应拒绝包含无效字符的项目名称", () => {
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

    it("应拒绝包含控制字符的项目名称", () => {
      expect(() => Validation.validateProjectName("my\u0000project")).toThrow(
        ValidationError
      );
      expect(() => Validation.validateProjectName("my\u0001project")).toThrow(
        ValidationError
      );
    });

    it("应拒绝以点开头的项目名称", () => {
      expect(() => Validation.validateProjectName(".myproject")).toThrow(
        ValidationError
      );
    });

    it("应拒绝过短或过长的项目名称", () => {
      expect(() => Validation.validateProjectName("")).toThrow(ValidationError);
      const longName = "a".repeat(101);
      expect(() => Validation.validateProjectName(longName)).toThrow(
        ValidationError
      );
    });
  });

  describe("验证模板名称", () => {
    it("应接受有效的模板名称", () => {
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

    it("应拒绝包含无效字符的模板名称", () => {
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

    it("应拒绝过短或过长的模板名称", () => {
      expect(() => Validation.validateTemplateName("")).toThrow(
        ValidationError
      );
      const longName = "a".repeat(51);
      expect(() => Validation.validateTemplateName(longName)).toThrow(
        ValidationError
      );
    });
  });

  describe("验证环境变量名", () => {
    it("应接受有效的环境变量名", () => {
      expect(() => Validation.validateEnvVarName("VAR_NAME")).not.toThrow();
      expect(() => Validation.validateEnvVarName("VAR123")).not.toThrow();
      expect(() => Validation.validateEnvVarName("_VAR_NAME")).not.toThrow();
      expect(() => Validation.validateEnvVarName("VAR_")).not.toThrow();
      expect(() => Validation.validateEnvVarName("V")).not.toThrow();
    });

    it("应拒绝包含无效字符的环境变量名", () => {
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

    it("应拒绝以数字开头的环境变量名", () => {
      expect(() => Validation.validateEnvVarName("1VAR_NAME")).toThrow(
        ValidationError
      );
      expect(() => Validation.validateEnvVarName("123VAR")).toThrow(
        ValidationError
      );
    });

    it("应拒绝空的环境变量名", () => {
      expect(() => Validation.validateEnvVarName("")).toThrow(ValidationError);
    });
  });

  describe("验证JSON", () => {
    it("应接受有效的JSON", () => {
      const validJson = '{"key": "value", "number": 42}';
      const result = Validation.validateJson(validJson);
      expect(result).toEqual({ key: "value", number: 42 });
    });

    it("应拒绝无效的JSON", () => {
      expect(() => Validation.validateJson('{"key": "value"')).toThrow(
        ValidationError
      );
      expect(() => Validation.validateJson("not json")).toThrow(
        ValidationError
      );
      expect(() => Validation.validateJson("")).toThrow(ValidationError);
    });

    it("应抛出带有正确消息的验证错误", () => {
      expect(() => Validation.validateJson('{"key": "value"')).toThrow(
        ValidationError
      );
      expect(() => Validation.validateJson('{"key": "value"')).toThrow(
        "无效的 JSON 格式"
      );
    });
  });

  describe("验证数字范围", () => {
    it("应接受范围内的数字", () => {
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

    it("应拒绝低于最小值的数字", () => {
      expect(() =>
        Validation.validateNumberRange(-1, "field", { min: 0 })
      ).toThrow(ValidationError);
    });

    it("应拒绝高于最大值的数字", () => {
      expect(() =>
        Validation.validateNumberRange(11, "field", { max: 10 })
      ).toThrow(ValidationError);
    });

    it("应抛出带有正确消息的验证错误", () => {
      expect(() =>
        Validation.validateNumberRange(-1, "field", { min: 0 })
      ).toThrow("值不能小于 0，当前值: -1");
      expect(() =>
        Validation.validateNumberRange(11, "field", { max: 10 })
      ).toThrow("值不能大于 10，当前值: 11");
    });
  });

  describe("验证数组长度", () => {
    it("应接受长度范围内的数组", () => {
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

    it("应拒绝短于最小长度的数组", () => {
      expect(() =>
        Validation.validateArrayLength([1, 2], "field", { min: 3 })
      ).toThrow(ValidationError);
    });

    it("应拒绝长于最大长度的数组", () => {
      expect(() =>
        Validation.validateArrayLength([1, 2, 3, 4], "field", { max: 3 })
      ).toThrow(ValidationError);
    });

    it("应抛出带有正确消息的验证错误", () => {
      expect(() =>
        Validation.validateArrayLength([1, 2], "field", { min: 3 })
      ).toThrow("数组长度不能少于 3，当前长度: 2");
      expect(() =>
        Validation.validateArrayLength([1, 2, 3, 4], "field", { max: 3 })
      ).toThrow("数组长度不能超过 3，当前长度: 4");
    });
  });

  describe("验证对象属性", () => {
    it("应接受包含所有必需属性的对象", () => {
      const obj = { name: "test", age: 25, city: "NYC" };
      expect(() =>
        Validation.validateObjectProperties(obj, ["name", "age"])
      ).not.toThrow();
    });

    it("应拒绝缺少必需属性的对象", () => {
      const obj = { name: "test" };
      expect(() =>
        Validation.validateObjectProperties(obj, ["name", "age"])
      ).toThrow(ValidationError);
    });

    it("应抛出带有正确消息的验证错误", () => {
      const obj = { name: "test" };
      expect(() =>
        Validation.validateObjectProperties(obj, ["name", "age"])
      ).toThrow("缺少必需的属性: age");
    });
  });

  describe("验证枚举值", () => {
    it("应接受有效的枚举值", () => {
      const validValues = ["option1", "option2", "option3"] as const;
      expect(
        Validation.validateEnum("option1", [...validValues] as const, "field")
      ).toBe("option1");
      expect(
        Validation.validateEnum("option2", [...validValues] as const, "field")
      ).toBe("option2");
    });

    it("应拒绝无效的枚举值", () => {
      const validValues = ["option1", "option2", "option3"] as const;
      expect(() =>
        Validation.validateEnum("invalid", [...validValues] as const, "field")
      ).toThrow(ValidationError);
    });

    it("应抛出带有正确消息的验证错误", () => {
      const validValues = ["option1", "option2", "option3"] as const;
      expect(() =>
        Validation.validateEnum("invalid", [...validValues] as const, "field")
      ).toThrow("无效的值: invalid，有效值: option1, option2, option3");
    });
  });

  describe("验证正则表达式", () => {
    it("应接受有效的正则表达式", () => {
      const result1 = Validation.validateRegex("^test$", "regex");
      expect(result1).toBeInstanceOf(RegExp);

      const result2 = Validation.validateRegex("\\d+", "regex");
      expect(result2).toBeInstanceOf(RegExp);
    });

    it("应拒绝无效的正则表达式", () => {
      expect(() => Validation.validateRegex("[invalid", "regex")).toThrow(
        ValidationError
      );
      expect(() => Validation.validateRegex("*invalid", "regex")).toThrow(
        ValidationError
      );
    });

    it("应抛出带有正确消息的验证错误", () => {
      expect(() => Validation.validateRegex("[invalid", "regex")).toThrow(
        "无效的正则表达式"
      );
    });
  });
});
