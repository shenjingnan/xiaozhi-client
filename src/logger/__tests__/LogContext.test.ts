import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LogContext, type LogContextData } from "../LogContext";

describe("LogContext", () => {
  let logContext: LogContext;

  beforeEach(() => {
    // 重置单例实例
    (LogContext as any).instance = undefined;
    logContext = LogContext.getInstance();
  });

  afterEach(() => {
    logContext.clear();
    vi.clearAllMocks();
  });

  describe("单例模式", () => {
    it("应该返回同一个实例", () => {
      const instance1 = LogContext.getInstance();
      const instance2 = LogContext.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("应该支持配置初始化", () => {
      (LogContext as any).instance = undefined;
      const config = { traceIdHeader: "custom-trace-id" };
      const instance = LogContext.getInstance(config);
      expect(instance).toBeDefined();
    });
  });

  describe("上下文管理", () => {
    it("应该能运行带上下文的函数", () => {
      const context: LogContextData = {
        trace: { traceId: "test-trace", spanId: "test-span" },
        user: { userId: "user123" },
      };

      const result = logContext.run(context, () => {
        const currentContext = logContext.getContext();
        expect(currentContext?.trace?.traceId).toBe("test-trace");
        expect(currentContext?.user?.userId).toBe("user123");
        return "success";
      });

      expect(result).toBe("success");
    });

    it("应该能运行带上下文的异步函数", async () => {
      const context: LogContextData = {
        trace: { traceId: "async-trace", spanId: "async-span" },
      };

      const result = await logContext.runAsync(context, async () => {
        const currentContext = logContext.getContext();
        expect(currentContext?.trace?.traceId).toBe("async-trace");
        return "async-success";
      });

      expect(result).toBe("async-success");
    });

    it("应该在上下文外返回undefined", () => {
      const context = logContext.getContext();
      expect(context).toBeUndefined();
    });

    it("应该能更新当前上下文", () => {
      const initialContext: LogContextData = {
        trace: { traceId: "initial", spanId: "span1" },
      };

      logContext.run(initialContext, () => {
        logContext.updateContext({
          user: { userId: "user456" },
          trace: { spanId: "span2" },
        });

        const updated = logContext.getContext();
        expect(updated?.trace?.traceId).toBe("initial");
        expect(updated?.trace?.spanId).toBe("span2");
        expect(updated?.user?.userId).toBe("user456");
      });
    });
  });

  describe("从HTTP请求头创建上下文", () => {
    it("应该从请求头提取追踪信息", () => {
      const headers = {
        "x-trace-id": "header-trace-id",
        "x-span-id": "header-span-id",
        "x-correlation-id": "correlation-123",
        "x-user-id": "user789",
        "x-session-id": "session456",
        "user-agent": "Mozilla/5.0",
        "x-forwarded-for": "192.168.1.1",
      };

      const context = logContext.createContextFromHeaders(headers);

      expect(context.trace?.traceId).toBe("header-trace-id");
      expect(context.trace?.spanId).toBe("header-span-id");
      expect(context.request?.correlationId).toBe("correlation-123");
      expect(context.user?.userId).toBe("user789");
      expect(context.user?.sessionId).toBe("session456");
      expect(context.user?.userAgent).toBe("Mozilla/5.0");
      expect(context.user?.ip).toBe("192.168.1.1");
    });

    it("应该生成缺失的追踪ID", () => {
      const headers = {};
      const context = logContext.createContextFromHeaders(headers);

      expect(context.trace?.traceId).toBeDefined();
      expect(context.trace?.spanId).toBeDefined();
      expect(context.request?.requestId).toBeDefined();
      expect(context.request?.startTime).toBeInstanceOf(Date);
    });

    it("应该清理敏感请求头", () => {
      const headers = {
        authorization: "Bearer token123",
        cookie: "session=abc123",
        "x-api-key": "secret-key",
        "content-type": "application/json",
      };

      const context = logContext.createContextFromHeaders(headers);

      expect(context.request?.headers?.authorization).toBe("[REDACTED]");
      expect(context.request?.headers?.cookie).toBe("[REDACTED]");
      expect(context.request?.headers?.["x-api-key"]).toBe("[REDACTED]");
      expect(context.request?.headers?.["content-type"]).toBe(
        "application/json"
      );
    });

    it("应该处理数组形式的请求头", () => {
      const headers = {
        "x-trace-id": ["trace1", "trace2"],
        "user-agent": ["Mozilla/5.0"],
      };

      const context = logContext.createContextFromHeaders(headers);

      expect(context.trace?.traceId).toBe("trace1");
      expect(context.user?.userAgent).toBe("Mozilla/5.0");
    });
  });

  describe("子span创建", () => {
    it("应该创建子span", () => {
      const parentContext: LogContextData = {
        trace: { traceId: "parent-trace", spanId: "parent-span" },
      };

      logContext.run(parentContext, () => {
        const childContext = logContext.createChildSpan("database-query", {
          table: "users",
          operation: "SELECT",
        });

        expect(childContext.trace?.traceId).toBe("parent-trace");
        expect(childContext.trace?.parentSpanId).toBe("parent-span");
        expect(childContext.trace?.spanId).toBeDefined();
        expect(childContext.trace?.spanId).not.toBe("parent-span");
        expect(childContext.business?.operation).toBe("database-query");
        expect(childContext.business?.metadata?.table).toBe("users");
      });
    });

    it("应该在没有父上下文时创建新的trace", () => {
      const childContext = logContext.createChildSpan("standalone-operation");

      expect(childContext.trace?.traceId).toBeDefined();
      expect(childContext.trace?.spanId).toBeDefined();
      expect(childContext.trace?.parentSpanId).toBeUndefined();
      expect(childContext.business?.operation).toBe("standalone-operation");
    });
  });

  describe("上下文设置方法", () => {
    it("应该设置用户上下文", () => {
      const initialContext: LogContextData = {
        trace: { traceId: "test", spanId: "test" },
      };

      logContext.run(initialContext, () => {
        logContext.setUserContext({
          userId: "user123",
          sessionId: "session456",
          roles: ["admin", "user"],
        });

        const context = logContext.getContext();
        expect(context?.user?.userId).toBe("user123");
        expect(context?.user?.sessionId).toBe("session456");
        expect(context?.user?.roles).toEqual(["admin", "user"]);
      });
    });

    it("应该设置业务上下文", () => {
      const initialContext: LogContextData = {};

      logContext.run(initialContext, () => {
        logContext.setBusinessContext({
          operation: "user-login",
          module: "auth",
          feature: "authentication",
          version: "1.0.0",
        });

        const context = logContext.getContext();
        expect(context?.business?.operation).toBe("user-login");
        expect(context?.business?.module).toBe("auth");
        expect(context?.business?.feature).toBe("authentication");
        expect(context?.business?.version).toBe("1.0.0");
      });
    });

    it("应该设置自定义上下文", () => {
      const initialContext: LogContextData = {};

      logContext.run(initialContext, () => {
        logContext.setCustomContext({
          customField1: "value1",
          customField2: 42,
          customField3: { nested: "object" },
        });

        const context = logContext.getContext();
        expect(context?.custom?.customField1).toBe("value1");
        expect(context?.custom?.customField2).toBe(42);
        expect(context?.custom?.customField3).toEqual({ nested: "object" });
      });
    });
  });

  describe("信息获取方法", () => {
    it("应该获取追踪信息", () => {
      const context: LogContextData = {
        trace: {
          traceId: "trace123",
          spanId: "span456",
          parentSpanId: "parent789",
        },
      };

      logContext.run(context, () => {
        const traceInfo = logContext.getTraceInfo();
        expect(traceInfo.traceId).toBe("trace123");
        expect(traceInfo.spanId).toBe("span456");
        expect(traceInfo.parentSpanId).toBe("parent789");
      });
    });

    it("应该获取用户信息", () => {
      const context: LogContextData = {
        user: {
          userId: "user123",
          sessionId: "session456",
          userAgent: "Mozilla/5.0",
          ip: "192.168.1.1",
        },
      };

      logContext.run(context, () => {
        const userInfo = logContext.getUserInfo();
        expect(userInfo.userId).toBe("user123");
        expect(userInfo.sessionId).toBe("session456");
        expect(userInfo.userAgent).toBe("Mozilla/5.0");
        expect(userInfo.ip).toBe("192.168.1.1");
      });
    });

    it("应该获取请求信息", () => {
      const context: LogContextData = {
        request: {
          requestId: "req123",
          method: "POST",
          url: "/api/users",
          correlationId: "corr456",
          startTime: new Date(),
        },
      };

      logContext.run(context, () => {
        const requestInfo = logContext.getRequestInfo();
        expect(requestInfo.requestId).toBe("req123");
        expect(requestInfo.method).toBe("POST");
        expect(requestInfo.url).toBe("/api/users");
        expect(requestInfo.correlationId).toBe("corr456");
      });
    });

    it("应该获取业务信息", () => {
      const context: LogContextData = {
        business: {
          operation: "create-user",
          module: "user-management",
          feature: "registration",
          version: "2.0.0",
        },
      };

      logContext.run(context, () => {
        const businessInfo = logContext.getBusinessInfo();
        expect(businessInfo.operation).toBe("create-user");
        expect(businessInfo.module).toBe("user-management");
        expect(businessInfo.feature).toBe("registration");
        expect(businessInfo.version).toBe("2.0.0");
      });
    });

    it("应该获取完整的日志上下文", () => {
      const context: LogContextData = {
        trace: { traceId: "trace123", spanId: "span456" },
        user: { userId: "user123", sessionId: "session456" },
        request: { requestId: "req123", method: "GET", url: "/api/test" },
        business: { operation: "test-operation", module: "test" },
        custom: { customField: "customValue" },
      };

      logContext.run(context, () => {
        const loggingContext = logContext.getContextForLogging();
        expect(loggingContext.traceId).toBe("trace123");
        expect(loggingContext.userId).toBe("user123");
        expect(loggingContext.requestId).toBe("req123");
        expect(loggingContext.operation).toBe("test-operation");
        expect(loggingContext.custom).toEqual({ customField: "customValue" });
      });
    });
  });

  describe("配置管理", () => {
    it("应该更新配置", () => {
      logContext.updateConfig({
        traceIdHeader: "custom-trace-header",
        enabled: false,
      });

      // 测试配置是否生效
      const headers = { "custom-trace-header": "custom-trace-id" };
      const context = logContext.createContextFromHeaders(headers);
      expect(context.trace?.traceId).toBe("custom-trace-id");
    });

    it("应该支持启用/禁用", () => {
      logContext.setEnabled(false);

      const context: LogContextData = {
        trace: { traceId: "test", spanId: "test" },
      };
      const result = logContext.run(context, () => {
        return logContext.getContext();
      });

      expect(result).toBeUndefined();
    });
  });

  describe("中间件", () => {
    it("应该创建Express中间件", () => {
      const middleware = logContext.middleware();
      expect(typeof middleware).toBe("function");

      const req = {
        method: "GET",
        url: "/api/test",
        headers: {
          "x-trace-id": "middleware-trace",
          "user-agent": "test-agent",
        },
      };

      const res = {
        setHeader: vi.fn(),
      };

      const next = vi.fn();

      middleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        "x-trace-id",
        "middleware-trace"
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        "x-request-id",
        expect.any(String)
      );
      expect(next).toHaveBeenCalled();
    });

    it("应该在禁用时直接调用next", () => {
      logContext.setEnabled(false);
      const middleware = logContext.middleware();

      const req = {};
      const res = { setHeader: vi.fn() };
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.setHeader).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe("清理功能", () => {
    it("应该清理当前上下文", () => {
      const context: LogContextData = {
        trace: { traceId: "test", spanId: "test" },
      };

      logContext.run(context, () => {
        expect(logContext.getContext()).toBeDefined();
        logContext.clear();
        expect(logContext.getContext()).toEqual({});
      });
    });
  });
});
