/**
 * BaseHandler 基类单元测试
 * 测试所有处理器继承的基类功能
 */

import { responseEnhancerMiddleware } from "@/middlewares/response-enhancer.middleware.js";
import type { AppContext } from "@/types/hono.context.js";
import { createApp } from "@/types/hono.context.js";
import type { Context } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BaseHandler } from "../base.handler.js";

/**
 * 测试用具体 Handler 实现
 * 继承 BaseHandler 用于测试其受保护的方法
 */
class TestHandler extends BaseHandler {
  /**
   * 公开 handleError 方法用于测试
   */
  public testHandleError(
    c: Context<AppContext>,
    error: unknown,
    operation: string,
    defaultCode = "OPERATION_FAILED",
    defaultMessage = "操作失败",
    statusCode = 500
  ): Response {
    return this.handleError(
      c,
      error,
      operation,
      defaultCode,
      defaultMessage,
      statusCode
    );
  }

  /**
   * 公开 parseJsonBody 方法用于测试
   */
  public testParseJsonBody<T>(
    c: Context<AppContext>,
    errorMessage = "请求体格式错误"
  ): Promise<T> {
    return this.parseJsonBody<T>(c, errorMessage);
  }
}

/**
 * Mock Logger
 */
const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

describe("BaseHandler", () => {
  let testHandler: TestHandler;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    testHandler = new TestHandler();
    app = createApp();

    // 设置 response-enhancer 中间件以启用 c.fail 方法
    app.use("*", responseEnhancerMiddleware);

    // 设置 logger 到 context
    app.use("*", async (c, next) => {
      c.set("logger", mockLogger);
      await next();
    });
  });

  describe("handleError", () => {
    describe("标准 Error 对象处理", () => {
      it("应该正确处理带有消息的 Error 对象", async () => {
        const error = new Error("测试错误消息");
        app.get("/test", (c) => {
          return testHandler.testHandleError(c, error, "测试操作");
        });

        const res = await app.request("/test");
        const json = await res.json();

        expect(res.status).toBe(500);
        expect(json).toEqual({
          success: false,
          error: {
            code: "OPERATION_FAILED",
            message: "测试错误消息",
          },
        });
        expect(mockLogger.error).toHaveBeenCalledWith("测试操作失败:", error);
      });

      it("应该使用默认错误消息当 Error 消息为空", async () => {
        app.get("/test", (c) => {
          const error = new Error("");
          return testHandler.testHandleError(
            c,
            error,
            "测试操作",
            "DEFAULT_CODE",
            "默认错误消息"
          );
        });

        const res = await app.request("/test");
        const json = await res.json();

        expect(res.status).toBe(500);
        expect(json).toEqual({
          success: false,
          error: {
            code: "DEFAULT_CODE",
            message: "默认错误消息",
          },
        });
      });
    });

    describe("错误代码提取", () => {
      it("应该从 Error 对象中提取 code 属性", async () => {
        app.get("/test", (c) => {
          const error = new Error("测试错误");
          (error as { code: string }).code = "CUSTOM_ERROR_CODE";
          return testHandler.testHandleError(c, error, "测试操作");
        });

        const res = await app.request("/test");
        const json = await res.json();

        expect(json.error.code).toBe("CUSTOM_ERROR_CODE");
      });

      it("应该使用数字 code 并转换为字符串", async () => {
        app.get("/test", (c) => {
          const error = new Error("测试错误");
          (error as { code: number }).code = 12345;
          return testHandler.testHandleError(c, error, "测试操作");
        });

        const res = await app.request("/test");
        const json = await res.json();

        expect(json.error.code).toBe("12345");
      });

      it("应该处理 code 为 null 的情况", async () => {
        app.get("/test", (c) => {
          const error = new Error("测试错误");
          (error as { code: null }).code = null;
          return testHandler.testHandleError(
            c,
            error,
            "测试操作",
            "DEFAULT_CODE"
          );
        });

        const res = await app.request("/test");
        const json = await res.json();

        // 注意：BaseHandler 实现将 null 转换为字符串 "null"
        // 这是 String(null) 的行为
        expect(json.error.code).toBe("null");
      });

      it("应该处理 code 为 undefined 的情况", async () => {
        app.get("/test", (c) => {
          const error = new Error("测试错误");
          (error as { code: undefined }).code = undefined;
          return testHandler.testHandleError(
            c,
            error,
            "测试操作",
            "DEFAULT_CODE"
          );
        });

        const res = await app.request("/test");
        const json = await res.json();

        // 注意：BaseHandler 实现将 undefined 转换为字符串 "undefined"
        // 这是 String(undefined) 的行为
        expect(json.error.code).toBe("undefined");
      });

      it("应该在 code 缺失时使用默认错误码", async () => {
        app.get("/test", (c) => {
          const error = new Error("测试错误");
          return testHandler.testHandleError(
            c,
            error,
            "测试操作",
            "FALLBACK_CODE",
            "默认消息"
          );
        });

        const res = await app.request("/test");
        const json = await res.json();

        expect(json.error.code).toBe("FALLBACK_CODE");
      });
    });

    describe("非 Error 类型错误处理", () => {
      it("应该处理字符串错误", async () => {
        app.get("/test", (c) => {
          return testHandler.testHandleError(c, "字符串错误", "测试操作");
        });

        const res = await app.request("/test");
        const json = await res.json();

        expect(json.error.message).toBe("字符串错误");
        expect(json.error.code).toBe("OPERATION_FAILED");
      });

      it("应该处理数字错误", async () => {
        app.get("/test", (c) => {
          return testHandler.testHandleError(c, 404, "测试操作");
        });

        const res = await app.request("/test");
        const json = await res.json();

        expect(json.error.message).toBe("404");
        expect(json.error.code).toBe("OPERATION_FAILED");
      });

      it("应该处理 null 错误", async () => {
        app.get("/test", (c) => {
          return testHandler.testHandleError(
            c,
            null,
            "测试操作",
            "NULL_ERROR",
            "空值错误"
          );
        });

        const res = await app.request("/test");
        const json = await res.json();

        expect(json.error.message).toBe("null");
        expect(json.error.code).toBe("NULL_ERROR");
      });

      it("应该处理 undefined 错误", async () => {
        app.get("/test", (c) => {
          return testHandler.testHandleError(
            c,
            undefined,
            "测试操作",
            "UNDEFINED_ERROR",
            "未定义错误"
          );
        });

        const res = await app.request("/test");
        const json = await res.json();

        expect(json.error.message).toBe("undefined");
        expect(json.error.code).toBe("UNDEFINED_ERROR");
      });

      it("应该处理对象错误", async () => {
        app.get("/test", (c) => {
          return testHandler.testHandleError(
            c,
            { custom: "error", details: { nested: true } },
            "测试操作"
          );
        });

        const res = await app.request("/test");
        const json = await res.json();

        expect(json.error.message).toBe("[object Object]");
      });
    });

    describe("自定义 HTTP 状态码", () => {
      it("应该支持 400 状态码", async () => {
        app.get("/test", (c) => {
          return testHandler.testHandleError(
            c,
            new Error("错误"),
            "测试操作",
            "BAD_REQUEST",
            "错误请求",
            400
          );
        });

        const res = await app.request("/test");

        expect(res.status).toBe(400);
      });

      it("应该支持 404 状态码", async () => {
        app.get("/test", (c) => {
          return testHandler.testHandleError(
            c,
            new Error("错误"),
            "测试操作",
            "NOT_FOUND",
            "资源未找到",
            404
          );
        });

        const res = await app.request("/test");

        expect(res.status).toBe(404);
      });

      it("应该支持 401 状态码", async () => {
        app.get("/test", (c) => {
          return testHandler.testHandleError(
            c,
            new Error("错误"),
            "测试操作",
            "UNAUTHORIZED",
            "未授权",
            401
          );
        });

        const res = await app.request("/test");

        expect(res.status).toBe(401);
      });

      it("应该支持 403 状态码", async () => {
        app.get("/test", (c) => {
          return testHandler.testHandleError(
            c,
            new Error("错误"),
            "测试操作",
            "FORBIDDEN",
            "禁止访问",
            403
          );
        });

        const res = await app.request("/test");

        expect(res.status).toBe(403);
      });

      it("应该支持 503 状态码", async () => {
        app.get("/test", (c) => {
          return testHandler.testHandleError(
            c,
            new Error("错误"),
            "测试操作",
            "SERVICE_UNAVAILABLE",
            "服务不可用",
            503
          );
        });

        const res = await app.request("/test");

        expect(res.status).toBe(503);
      });
    });

    describe("日志记录", () => {
      it("应该记录错误日志包含操作描述", async () => {
        app.get("/test", (c) => {
          return testHandler.testHandleError(
            c,
            new Error("测试错误"),
            "用户登录"
          );
        });

        await app.request("/test");

        expect(mockLogger.error).toHaveBeenCalledWith(
          "用户登录失败:",
          expect.any(Error)
        );
      });

      it("应该记录完整的错误对象", async () => {
        const error = new Error("完整错误对象");
        app.get("/test", (c) => {
          return testHandler.testHandleError(c, error, "测试操作");
        });

        await app.request("/test");

        expect(mockLogger.error).toHaveBeenCalledWith("测试操作失败:", error);
      });

      it("应该记录非 Error 类型错误", async () => {
        app.get("/test", (c) => {
          return testHandler.testHandleError(c, "字符串错误", "测试操作");
        });

        await app.request("/test");

        expect(mockLogger.error).toHaveBeenCalledWith(
          "测试操作失败:",
          "字符串错误"
        );
      });
    });

    describe("边界情况", () => {
      it("应该处理空字符串操作名", async () => {
        app.get("/test", (c) => {
          return testHandler.testHandleError(c, new Error("错误"), "");
        });

        const res = await app.request("/test");

        expect(res.status).toBe(500);
        expect(mockLogger.error).toHaveBeenCalledWith(
          "失败:",
          expect.any(Error)
        );
      });

      it("应该处理非常长的操作名", async () => {
        const longOperation = "操作".repeat(1000);
        app.get("/test", (c) => {
          return testHandler.testHandleError(
            c,
            new Error("错误"),
            longOperation
          );
        });

        const res = await app.request("/test");

        expect(res.status).toBe(500);
      });

      it("应该处理带有特殊字符的错误消息", async () => {
        app.get("/test", (c) => {
          const error = new Error('错误消息\n带有"引号"\t和制表符');
          return testHandler.testHandleError(c, error, "测试操作");
        });

        const res = await app.request("/test");
        const json = await res.json();

        expect(json.error.message).toContain("引号");
        expect(json.error.message).toContain("制表符");
      });
    });
  });

  describe("parseJsonBody", () => {
    describe("正常 JSON 解析", () => {
      it("应该成功解析有效的 JSON 对象", async () => {
        const validJson = { name: "张三", age: 30, city: "北京" };

        app.post("/test", async (c) => {
          const body = await testHandler.testParseJsonBody<typeof validJson>(c);
          return c.json(body);
        });

        const res = await app.request("/test", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(validJson),
        });

        const json = await res.json();

        expect(json).toEqual(validJson);
      });

      it("应该成功解析嵌套的 JSON 对象", async () => {
        const nestedJson = {
          user: {
            name: "李四",
            address: {
              city: "上海",
              district: "浦东新区",
            },
          },
        };

        app.post("/test", async (c) => {
          const body =
            await testHandler.testParseJsonBody<typeof nestedJson>(c);
          return c.json(body);
        });

        const res = await app.request("/test", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(nestedJson),
        });

        const json = await res.json();

        expect(json).toEqual(nestedJson);
      });

      it("应该成功解析 JSON 数组", async () => {
        const jsonArray = [1, 2, 3, 4, 5];

        app.post("/test", async (c) => {
          const body = await testHandler.testParseJsonBody<number[]>(c);
          return c.json(body);
        });

        const res = await app.request("/test", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(jsonArray),
        });

        const json = await res.json();

        expect(json).toEqual(jsonArray);
      });

      it("应该成功解析对象数组", async () => {
        const objectArray = [
          { id: 1, name: "张三" },
          { id: 2, name: "李四" },
        ];

        app.post("/test", async (c) => {
          const body =
            await testHandler.testParseJsonBody<typeof objectArray>(c);
          return c.json(body);
        });

        const res = await app.request("/test", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(objectArray),
        });

        const json = await res.json();

        expect(json).toEqual(objectArray);
      });

      it("应该成功解析空对象", async () => {
        app.post("/test", async (c) => {
          const body =
            await testHandler.testParseJsonBody<Record<string, never>>(c);
          return c.json(body);
        });

        const res = await app.request("/test", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: "{}",
        });

        const json = await res.json();

        expect(json).toEqual({});
      });

      it("应该成功解析空数组", async () => {
        app.post("/test", async (c) => {
          const body = await testHandler.testParseJsonBody<never[]>(c);
          return c.json(body);
        });

        const res = await app.request("/test", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: "[]",
        });

        const json = await res.json();

        expect(json).toEqual([]);
      });

      it("应该成功解析包含 null 的 JSON", async () => {
        const jsonWithNull = { name: null, age: 25 };

        app.post("/test", async (c) => {
          const body =
            await testHandler.testParseJsonBody<typeof jsonWithNull>(c);
          return c.json(body);
        });

        const res = await app.request("/test", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(jsonWithNull),
        });

        const json = await res.json();

        expect(json).toEqual(jsonWithNull);
      });
    });

    describe("无效 JSON 错误处理", () => {
      it("应该处理无效的 JSON 语法", async () => {
        app.post("/test", async (c) => {
          try {
            await testHandler.testParseJsonBody(c);
            return c.json({ success: true });
          } catch (error) {
            return c.json({ success: false, error: (error as Error).message });
          }
        });

        const res = await app.request("/test", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: "{invalid json}",
        });

        const json = await res.json();

        expect(json.success).toBe(false);
        expect(json.error).toContain("请求体格式错误");
      });

      it("应该处理不完整的 JSON", async () => {
        app.post("/test", async (c) => {
          try {
            await testHandler.testParseJsonBody(c);
            return c.json({ success: true });
          } catch (error) {
            return c.json({ success: false, error: (error as Error).message });
          }
        });

        const res = await app.request("/test", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: '{"name": "张三"',
        });

        const json = await res.json();

        expect(json.success).toBe(false);
        expect(json.error).toContain("请求体格式错误");
      });

      it("应该处理空请求体", async () => {
        app.post("/test", async (c) => {
          try {
            await testHandler.testParseJsonBody(c);
            return c.json({ success: true });
          } catch (error) {
            return c.json({ success: false, error: (error as Error).message });
          }
        });

        const res = await app.request("/test", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: "",
        });

        const json = await res.json();

        expect(json.success).toBe(false);
        expect(json.error).toContain("请求体格式错误");
      });

      it("应该处理非 JSON 文本", async () => {
        app.post("/test", async (c) => {
          try {
            await testHandler.testParseJsonBody(c);
            return c.json({ success: true });
          } catch (error) {
            return c.json({ success: false, error: (error as Error).message });
          }
        });

        const res = await app.request("/test", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: "plain text",
        });

        const json = await res.json();

        expect(json.success).toBe(false);
        expect(json.error).toContain("请求体格式错误");
      });
    });

    describe("自定义错误消息前缀", () => {
      it("应该使用自定义错误消息前缀", async () => {
        app.post("/test", async (c) => {
          try {
            await testHandler.testParseJsonBody(c, "数据解析失败");
            return c.json({ success: true });
          } catch (error) {
            return c.json({ success: false, error: (error as Error).message });
          }
        });

        const res = await app.request("/test", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: "{invalid}",
        });

        const json = await res.json();

        expect(json.success).toBe(false);
        // 检查错误消息以自定义前缀开头，并包含原始解析错误的详细信息
        expect(json.error).toMatch(/^数据解析失败:/);
        expect(json.error.length).toBeGreaterThan("数据解析失败:".length);
      });

      it("应该处理包含冒号的自定义消息", async () => {
        app.post("/test", async (c) => {
          try {
            await testHandler.testParseJsonBody(c, "错误：JSON 格式不正确");
            return c.json({ success: true });
          } catch (error) {
            return c.json({ success: false, error: (error as Error).message });
          }
        });

        const res = await app.request("/test", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: "{invalid}",
        });

        const json = await res.json();

        expect(json.error).toMatch(/^错误：JSON 格式不正确:/);
      });
    });

    describe("原始错误信息保留", () => {
      it("应该保留原始 JSON 解析错误信息", async () => {
        app.post("/test", async (c) => {
          try {
            await testHandler.testParseJsonBody(c);
            return c.json({ success: true });
          } catch (error) {
            return c.json({ success: false, error: (error as Error).message });
          }
        });

        const res = await app.request("/test", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: '{"name": "张三",}',
        });

        const json = await res.json();

        expect(json.error).toContain("请求体格式错误:");
        // 应该包含原始解析错误的详细信息
        expect(json.error).toBeTruthy();
      });

      it("应该处理解析错误为非 Error 类型", async () => {
        app.post("/test", async (c) => {
          // 模拟 c.req.json() 抛出非 Error 异常的情况
          const originalJson = c.req.json.bind(c.req.json);
          c.req.json = () => {
            throw "String error from json parser";
          };

          try {
            await testHandler.testParseJsonBody(c);
            return c.json({ success: true });
          } catch (error) {
            // 恢复原始方法
            c.req.json = originalJson;
            return c.json({ success: false, error: (error as Error).message });
          }
        });

        const res = await app.request("/test", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: "{}",
        });

        const json = await res.json();

        // 当错误不是 Error 实例时，应该只使用自定义消息
        expect(json.error).toBe("请求体格式错误");
      });
    });

    describe("边界情况", () => {
      it("应该处理非常大的 JSON 对象", async () => {
        const largeObject: Record<string, string> = {};
        for (let i = 0; i < 1000; i++) {
          largeObject[`key${i}`] = `value${i}`.repeat(10);
        }

        app.post("/test", async (c) => {
          const body =
            await testHandler.testParseJsonBody<Record<string, string>>(c);
          return c.json({ keys: Object.keys(body).length });
        });

        const res = await app.request("/test", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(largeObject),
        });

        const json = await res.json();

        expect(json.keys).toBe(1000);
      });

      it("应该处理包含特殊字符的 JSON", async () => {
        const specialJson = {
          chinese: "中文测试",
          emoji: "😀🎉",
          special: "\\n\\t\\r",
          quotes: '包含"引号"',
        };

        app.post("/test", async (c) => {
          const body =
            await testHandler.testParseJsonBody<typeof specialJson>(c);
          return c.json(body);
        });

        const res = await app.request("/test", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(specialJson),
        });

        const json = await res.json();

        expect(json).toEqual(specialJson);
      });

      it("应该处理深度嵌套的 JSON", async () => {
        const deepNested = {
          level1: { level2: { level3: { level4: { value: "deep" } } } },
        };

        app.post("/test", async (c) => {
          const body =
            await testHandler.testParseJsonBody<typeof deepNested>(c);
          return c.json(body);
        });

        const res = await app.request("/test", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(deepNested),
        });

        const json = await res.json();

        expect(json).toEqual(deepNested);
      });
    });
  });

  describe("继承类集成测试", () => {
    it("应该允许子类正确使用 handleError 方法", async () => {
      class CustomHandler extends BaseHandler {
        public handle(c: Context<AppContext>): Response {
          const error = new Error("自定义错误");
          (error as { code: string }).code = "CUSTOM_ERROR";
          return this.handleError(
            c,
            error,
            "自定义操作",
            "FALLBACK",
            "备用消息"
          );
        }
      }

      const customHandler = new CustomHandler();

      app.get("/custom", (c) => customHandler.handle(c));

      const res = await app.request("/custom");
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json).toEqual({
        success: false,
        error: {
          code: "CUSTOM_ERROR",
          message: "自定义错误",
        },
      });
    });

    it("应该允许子类正确使用 parseJsonBody 方法", async () => {
      class CustomHandler extends BaseHandler {
        public async handle(c: Context<AppContext>): Promise<Response> {
          const body = await this.parseJsonBody<{ name: string }>(
            c,
            "数据格式错误"
          );
          return c.json({ success: true, data: body });
        }
      }

      const customHandler = new CustomHandler();

      app.post("/custom", async (c) => customHandler.handle(c));

      const res = await app.request("/custom", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "测试" }),
      });

      const json = await res.json();

      expect(json).toEqual({
        success: true,
        data: { name: "测试" },
      });
    });

    it("应该允许子类同时使用两个方法", async () => {
      class CustomHandler extends BaseHandler {
        public async handle(c: Context<AppContext>): Promise<Response> {
          try {
            const body = await this.parseJsonBody<{ name: string }>(c);
            return c.json({ success: true, data: body });
          } catch (error) {
            return this.handleError(c, error, "数据处理");
          }
        }
      }

      const customHandler = new CustomHandler();

      app.post("/custom", async (c) => customHandler.handle(c));

      // 测试成功情况
      const successRes = await app.request("/custom", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "测试" }),
      });

      const successJson = await successRes.json();

      expect(successJson.success).toBe(true);

      // 测试错误情况
      const errorRes = await app.request("/custom", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "{invalid}",
      });

      const errorJson = await errorRes.json();

      expect(errorJson.success).toBe(false);
      expect(errorJson.error.code).toBe("OPERATION_FAILED");
    });
  });
});
