import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type LogTemplate, StructuredLogger } from "../StructuredLogger";

describe("StructuredLogger", () => {
  let logger: StructuredLogger;

  beforeEach(() => {
    logger = new StructuredLogger();
  });

  describe("模板管理", () => {
    it("应该有默认模板", () => {
      const templates = logger.listTemplates();
      expect(templates.length).toBeGreaterThan(0);

      const templateNames = templates.map((t) => t.name);
      expect(templateNames).toContain("error");
      expect(templateNames).toContain("performance");
      expect(templateNames).toContain("business_event");
      expect(templateNames).toContain("http_request");
      expect(templateNames).toContain("database_operation");
    });

    it("应该能注册新模板", () => {
      const customTemplate: LogTemplate = {
        name: "custom",
        level: "info",
        fields: [
          { name: "id", type: "string", required: true },
          { name: "value", type: "number" },
        ],
      };

      logger.registerTemplate(customTemplate);

      const retrieved = logger.getTemplate("custom");
      expect(retrieved).toEqual(customTemplate);
    });

    it("应该能获取特定模板", () => {
      const errorTemplate = logger.getTemplate("error");
      expect(errorTemplate).toBeDefined();
      expect(errorTemplate?.name).toBe("error");
      expect(errorTemplate?.level).toBe("error");
    });

    it("应该返回undefined对于不存在的模板", () => {
      const nonExistent = logger.getTemplate("non_existent");
      expect(nonExistent).toBeUndefined();
    });
  });

  describe("数据验证", () => {
    it("应该验证必填字段", () => {
      const result = logger.validateData("error", {
        // 缺少必填的 message 和 error 字段
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("必填字段 'message' 缺失");
      expect(result.errors).toContain("必填字段 'error' 缺失");
    });

    it("应该验证字段类型", () => {
      const result = logger.validateData("error", {
        message: 123, // 应该是 string
        error: "not an object", // 应该是 object
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("字段 'message' 类型不匹配，期望 string");
      expect(result.errors).toContain("字段 'error' 类型不匹配，期望 object");
    });

    it("应该通过有效数据的验证", () => {
      const result = logger.validateData("error", {
        message: "Test error",
        error: { name: "TestError", message: "Test" },
        stack: "Error stack trace",
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitizedData.message).toBe("Test error");
    });

    it("应该处理不存在的模板", () => {
      const result = logger.validateData("non_existent", {});

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("模板 'non_existent' 不存在");
    });

    it("应该验证不同的字段类型", () => {
      logger.registerTemplate({
        name: "type_test",
        level: "info",
        fields: [
          { name: "str", type: "string" },
          { name: "num", type: "number" },
          { name: "bool", type: "boolean" },
          { name: "obj", type: "object" },
          { name: "arr", type: "array" },
          { name: "date", type: "date" },
        ],
      });

      const validData = {
        str: "test",
        num: 42,
        bool: true,
        obj: { key: "value" },
        arr: [1, 2, 3],
        date: new Date(),
      };

      const result = logger.validateData("type_test", validData);
      expect(result.valid).toBe(true);

      // 测试无效类型
      const invalidResult = logger.validateData("type_test", {
        str: 123,
        num: "not a number",
        bool: "not a boolean",
        obj: [],
        arr: {},
        date: "invalid date",
      });

      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });
  });

  describe("数据脱敏", () => {
    it("应该脱敏敏感字段", () => {
      const result = logger.validateData("http_request", {
        method: "POST",
        url: "/api/login",
        headers: {
          authorization: "Bearer token123",
          "content-type": "application/json",
        },
      });

      expect(result.valid).toBe(true);
      expect(result.sanitizedData.headers).toBe("[REDACTED]");
    });

    it("应该根据字段名模式脱敏", () => {
      const data = {
        username: "user123",
        password: "secret123",
        apiKey: "key123",
        normalField: "normal value",
      };

      const result = logger.formatStructuredData("business_event", data);

      expect(result.success).toBe(true);
      expect(result.data?.password).toBe("[REDACTED]");
      expect(result.data?.apiKey).toBe("[REDACTED]");
      expect(result.data?.normalField).toBe("normal value");
    });

    it("应该能禁用脱敏", () => {
      const loggerWithoutRedaction = new StructuredLogger({
        redactionConfig: { enabled: false },
      });

      const data = {
        password: "secret123",
        token: "token123",
      };

      const result = loggerWithoutRedaction.formatStructuredData(
        "business_event",
        data
      );

      expect(result.success).toBe(true);
      expect(result.data?.password).toBe("secret123");
      expect(result.data?.token).toBe("token123");
    });

    it("应该脱敏嵌套对象中的敏感数据", () => {
      const data = {
        user: {
          name: "John",
          password: "secret123",
          profile: {
            email: "john@example.com",
            apiKey: "key123",
          },
        },
      };

      const result = logger.formatStructuredData("business_event", data);

      expect(result.success).toBe(true);
      expect(result.data?.user.name).toBe("John");
      expect(result.data?.user.password).toBe("[REDACTED]");
      expect(result.data?.user.profile.email).toBe("john@example.com");
      expect(result.data?.user.profile.apiKey).toBe("[REDACTED]");
    });
  });

  describe("格式化方法", () => {
    it("应该在验证失败时返回错误", () => {
      const result = logger.formatStructuredData("error", {
        // 缺少必填字段
      });

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.data).toBeUndefined();
    });

    it("应该在验证成功时返回格式化数据", () => {
      const result = logger.formatStructuredData("error", {
        message: "Test error",
        error: { name: "TestError" },
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.errors).toBeUndefined();
    });

    it("应该在禁用验证时直接返回数据", () => {
      logger.setValidationEnabled(false);

      const result = logger.formatStructuredData("error", {
        // 即使缺少必填字段也应该成功
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("便捷方法", () => {
    it("应该创建错误日志", () => {
      const error = new Error("Test error");
      const context = { userId: "123" };

      const logData = logger.createErrorLog(error, context);

      expect(logData.message).toBe("Test error");
      expect(logData.error.name).toBe("Error");
      expect(logData.error.message).toBe("Test error");
      expect(logData.context).toEqual(context);
      expect(logData.timestamp).toBeInstanceOf(Date);
    });

    it("应该创建性能日志", () => {
      const logData = logger.createPerformanceLog("database_query", 150, {
        table: "users",
      });

      expect(logData.operation).toBe("database_query");
      expect(logData.duration).toBe(150);
      expect(logData.metadata).toEqual({ table: "users" });
      expect(logData.startTime).toBeInstanceOf(Date);
      expect(logData.endTime).toBeInstanceOf(Date);
    });

    it("应该创建业务事件日志", () => {
      const logData = logger.createBusinessEventLog(
        "user_login",
        "user123",
        "session456",
        { ip: "127.0.0.1" }
      );

      expect(logData.event).toBe("user_login");
      expect(logData.userId).toBe("user123");
      expect(logData.sessionId).toBe("session456");
      expect(logData.data).toEqual({ ip: "127.0.0.1" });
      expect(logData.timestamp).toBeInstanceOf(Date);
    });

    it("应该创建HTTP请求日志", () => {
      const logData = logger.createHttpRequestLog(
        "GET",
        "/api/users",
        200,
        50,
        { userAgent: "test" }
      );

      expect(logData.method).toBe("GET");
      expect(logData.url).toBe("/api/users");
      expect(logData.statusCode).toBe(200);
      expect(logData.duration).toBe(50);
      expect(logData.userAgent).toBe("test");
    });

    it("应该创建数据库操作日志", () => {
      const logData = logger.createDatabaseOperationLog(
        "SELECT",
        "users",
        "SELECT * FROM users",
        25,
        10
      );

      expect(logData.operation).toBe("SELECT");
      expect(logData.table).toBe("users");
      expect(logData.query).toBe("SELECT * FROM users");
      expect(logData.duration).toBe(25);
      expect(logData.rowsAffected).toBe(10);
    });
  });

  describe("配置更新", () => {
    it("应该能更新脱敏配置", () => {
      logger.updateRedactionConfig({
        replacement: "[HIDDEN]",
        sensitiveFields: ["customField"],
      });

      const data = { customField: "sensitive data" };
      const result = logger.formatStructuredData("business_event", data);

      expect(result.success).toBe(true);
      expect(result.data?.customField).toBe("[HIDDEN]");
    });

    it("应该能启用/禁用验证", () => {
      logger.setValidationEnabled(false);

      const result = logger.formatStructuredData("error", {});
      expect(result.success).toBe(true);

      logger.setValidationEnabled(true);

      const result2 = logger.formatStructuredData("error", {});
      expect(result2.success).toBe(false);
    });
  });

  describe("自定义验证器和格式化器", () => {
    it("应该支持自定义验证器", () => {
      logger.registerTemplate({
        name: "custom_validation",
        level: "info",
        fields: [
          {
            name: "email",
            type: "string",
            validator: (value: string) => value.includes("@"),
          },
        ],
      });

      const validResult = logger.validateData("custom_validation", {
        email: "test@example.com",
      });
      expect(validResult.valid).toBe(true);

      const invalidResult = logger.validateData("custom_validation", {
        email: "invalid-email",
      });
      expect(invalidResult.valid).toBe(false);
    });

    it("应该支持自定义格式化器", () => {
      logger.registerTemplate({
        name: "custom_formatter",
        level: "info",
        fields: [
          {
            name: "timestamp",
            type: "date",
            formatter: (value: Date) => value.toISOString(),
          },
        ],
      });

      const date = new Date("2023-01-01T00:00:00Z");
      const result = logger.validateData("custom_formatter", {
        timestamp: date,
      });

      expect(result.valid).toBe(true);
      expect(result.sanitizedData.timestamp).toBe("2023-01-01T00:00:00.000Z");
    });
  });
});
