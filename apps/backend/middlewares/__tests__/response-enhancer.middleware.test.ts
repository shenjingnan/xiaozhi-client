/**
 * 响应增强中间件单元测试
 */

import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { responseEnhancerMiddleware } from "../response-enhancer.middleware.js";

describe("response-enhancer.middleware", () => {
  describe("c.success", () => {
    it("应该返回成功的响应", async () => {
      const app = new Hono();
      app.use("*", responseEnhancerMiddleware);
      app.get("/test", (c) => c.success({ id: 1, name: "张三" }, "获取成功"));

      const res = await app.request("/test");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({
        success: true,
        data: { id: 1, name: "张三" },
        message: "获取成功",
      });
    });

    it("应该支持自定义状态码", async () => {
      const app = new Hono();
      app.use("*", responseEnhancerMiddleware);
      app.get("/test", (c) => c.success({ id: 1 }, "创建成功", 201));

      const res = await app.request("/test");

      expect(res.status).toBe(201);
    });

    it("应该支持无数据响应", async () => {
      const app = new Hono();
      app.use("*", responseEnhancerMiddleware);
      app.get("/test", (c) => c.success(undefined, "删除成功"));

      const res = await app.request("/test");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({
        success: true,
        message: "删除成功",
      });
      // data 字段不应该存在
      expect(json).not.toHaveProperty("data");
    });

    it("应该支持无消息响应", async () => {
      const app = new Hono();
      app.use("*", responseEnhancerMiddleware);
      app.get("/test", (c) => c.success({ id: 1 }));

      const res = await app.request("/test");
      const json = await res.json();

      expect(json).toEqual({
        success: true,
        data: { id: 1 },
        message: undefined,
      });
    });

    it("应该正确推断数据类型", async () => {
      const app = new Hono();
      app.use("*", responseEnhancerMiddleware);

      interface User {
        id: number;
        name: string;
      }

      app.get("/test", (c) => {
        const user: User = { id: 1, name: "张三" };
        return c.success(user);
      });

      const res = await app.request("/test");
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data.id).toBe(1);
      expect(json.data.name).toBe("张三");
    });
  });

  describe("c.fail", () => {
    it("应该返回错误的响应", async () => {
      const app = new Hono();
      app.use("*", responseEnhancerMiddleware);
      app.get("/test", (c) => c.fail("NOT_FOUND", "资源不存在"));

      const res = await app.request("/test");
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json).toEqual({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "资源不存在",
          details: undefined,
        },
      });
    });

    it("应该支持自定义状态码", async () => {
      const app = new Hono();
      app.use("*", responseEnhancerMiddleware);
      app.get("/test", (c) =>
        c.fail("UNAUTHORIZED", "未授权", undefined, 401)
      );

      const res = await app.request("/test");

      expect(res.status).toBe(401);
    });

    it("应该支持 404 状态码", async () => {
      const app = new Hono();
      app.use("*", responseEnhancerMiddleware);
      app.get("/test", (c) => c.fail("NOT_FOUND", "资源不存在", undefined, 404));

      const res = await app.request("/test");

      expect(res.status).toBe(404);
    });

    it("应该支持 500 状态码", async () => {
      const app = new Hono();
      app.use("*", responseEnhancerMiddleware);
      app.get("/test", (c) =>
        c.fail("INTERNAL_ERROR", "服务器内部错误", undefined, 500)
      );

      const res = await app.request("/test");

      expect(res.status).toBe(500);
    });

    it("应该支持错误详情", async () => {
      const app = new Hono();
      app.use("*", responseEnhancerMiddleware);
      app.get("/test", (c) =>
        c.fail("VALIDATION_ERROR", "数据验证失败", {
          field: "email",
          message: "邮箱格式不正确",
        })
      );

      const res = await app.request("/test");
      const json = await res.json();

      expect(json.error.details).toEqual({
        field: "email",
        message: "邮箱格式不正确",
      });
    });

    it("应该支持复杂错误详情", async () => {
      const app = new Hono();
      app.use("*", responseEnhancerMiddleware);
      app.get("/test", (c) => {
        const details = {
          errors: [
            { field: "email", message: "邮箱格式不正确" },
            { field: "password", message: "密码长度不能少于 8 位" },
          ],
        };
        return c.fail("VALIDATION_ERROR", "数据验证失败", details);
      });

      const res = await app.request("/test");
      const json = await res.json();

      expect(json.error.details).toEqual({
        errors: [
          { field: "email", message: "邮箱格式不正确" },
          { field: "password", message: "密码长度不能少于 8 位" },
        ],
      });
    });
  });

  describe("c.paginate", () => {
    it("应该返回分页的响应", async () => {
      const app = new Hono();
      app.use("*", responseEnhancerMiddleware);
      app.get("/test", (c) => {
        const data = [
          { id: 1, name: "张三" },
          { id: 2, name: "李四" },
        ];
        const pagination = {
          page: 1,
          pageSize: 10,
          total: 100,
          totalPages: 10,
          hasNext: true,
          hasPrev: false,
        };
        return c.paginate(data, pagination);
      });

      const res = await app.request("/test");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({
        success: true,
        data: [
          { id: 1, name: "张三" },
          { id: 2, name: "李四" },
        ],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 100,
          totalPages: 10,
          hasNext: true,
          hasPrev: false,
        },
        message: undefined,
      });
    });

    it("应该支持自定义消息", async () => {
      const app = new Hono();
      app.use("*", responseEnhancerMiddleware);
      app.get("/test", (c) => {
        const data = [{ id: 1, name: "张三" }];
        const pagination = {
          page: 1,
          pageSize: 10,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        };
        return c.paginate(data, pagination, "查询成功");
      });

      const res = await app.request("/test");
      const json = await res.json();

      expect(json.message).toBe("查询成功");
    });

    it("应该支持空数据列表", async () => {
      const app = new Hono();
      app.use("*", responseEnhancerMiddleware);
      app.get("/test", (c) => {
        const data: unknown[] = [];
        const pagination = {
          page: 1,
          pageSize: 10,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        };
        return c.paginate(data, pagination);
      });

      const res = await app.request("/test");
      const json = await res.json();

      expect(json.data).toEqual([]);
      expect(json.pagination.total).toBe(0);
    });

    it("应该正确推断数据类型", async () => {
      const app = new Hono();
      app.use("*", responseEnhancerMiddleware);

      interface User {
        id: number;
        name: string;
      }

      app.get("/test", (c) => {
        const users: User[] = [
          { id: 1, name: "张三" },
          { id: 2, name: "李四" },
        ];
        const pagination = {
          page: 1,
          pageSize: 10,
          total: 2,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        };
        return c.paginate(users, pagination);
      });

      const res = await app.request("/test");
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data[0].id).toBe(1);
      expect(json.data[0].name).toBe("张三");
    });
  });

  describe("中间件注册顺序", () => {
    it("应该在所有路由之前注册", async () => {
      const app = new Hono();
      app.use("*", responseEnhancerMiddleware);
      app.get("/test", (c) => c.success({ message: "ok" }));

      const res = await app.request("/test");

      // 验证中间件正确注册并工作
      expect(res.status).toBe(200);
    });

    it("应该不影响其他中间件", async () => {
      const app = new Hono();

      // 添加一个自定义中间件
      app.use("*", async (c, next) => {
        c.set("logger" as never, "value");
        await next();
      });

      app.use("*", responseEnhancerMiddleware);
      app.get("/test", (c) => {
        const custom = c.get("logger" as never);
        return c.success({ custom });
      });

      const res = await app.request("/test");
      const json = await res.json();

      expect(json.data.custom).toBe("value");
    });
  });

  describe("类型安全", () => {
    it("c.success 应该正确推断响应数据类型", async () => {
      const app = new Hono();
      app.use("*", responseEnhancerMiddleware);

      interface User {
        id: number;
        name: string;
        email: string;
      }

      app.get("/test", (c) => {
        const user: User = {
          id: 1,
          name: "张三",
          email: "zhangsan@example.com",
        };
        return c.success(user, "获取用户成功");
      });

      const res = await app.request("/test");
      const json = await res.json();

      // 验证响应结构
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(1);
      expect(json.data.name).toBe("张三");
      expect(json.data.email).toBe("zhangsan@example.com");
      expect(json.message).toBe("获取用户成功");
    });

    it("c.fail 应该正确处理不同类型的错误详情", async () => {
      const app = new Hono();
      app.use("*", responseEnhancerMiddleware);

      app.get("/test", (c) => {
        const details = {
          timestamp: new Date().toISOString(),
          path: "/test",
          method: "GET",
        };
        return c.fail("ERROR", "发生错误", details, 500);
      });

      const res = await app.request("/test");
      const json = await res.json();

      expect(json.success).toBe(false);
      expect(json.error.code).toBe("ERROR");
      expect(json.error.details).toHaveProperty("timestamp");
      expect(json.error.details).toHaveProperty("path");
      expect(json.error.details).toHaveProperty("method");
    });

    it("c.paginate 应该正确推断分页数据类型", async () => {
      const app = new Hono();
      app.use("*", responseEnhancerMiddleware);

      interface Product {
        id: number;
        name: string;
        price: number;
      }

      app.get("/test", (c) => {
        const products: Product[] = [
          { id: 1, name: "商品A", price: 100 },
          { id: 2, name: "商品B", price: 200 },
        ];
        const pagination = {
          page: 1,
          pageSize: 10,
          total: 2,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        };
        return c.paginate(products, pagination, "查询商品成功");
      });

      const res = await app.request("/test");
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data[0].id).toBe(1);
      expect(json.data[0].name).toBe("商品A");
      expect(json.data[0].price).toBe(100);
      expect(json.message).toBe("查询商品成功");
    });
  });

  describe("边界情况", () => {
    it("c.success 应该支持 null 数据", async () => {
      const app = new Hono();
      app.use("*", responseEnhancerMiddleware);
      app.get("/test", (c) => c.success(null, "数据为空"));

      const res = await app.request("/test");
      const json = await res.json();

      expect(json.data).toBeNull();
      expect(json.message).toBe("数据为空");
    });

    it("c.success 应该支持空对象", async () => {
      const app = new Hono();
      app.use("*", responseEnhancerMiddleware);
      app.get("/test", (c) => c.success({}, "空对象"));

      const res = await app.request("/test");
      const json = await res.json();

      expect(json.data).toEqual({});
    });

    it("c.fail 应该支持 null 详情", async () => {
      const app = new Hono();
      app.use("*", responseEnhancerMiddleware);
      app.get("/test", (c) => c.fail("ERROR", "错误", null));

      const res = await app.request("/test");
      const json = await res.json();

      expect(json.error.details).toBeNull();
    });

    it("c.paginate 应该支持单页数据", async () => {
      const app = new Hono();
      app.use("*", responseEnhancerMiddleware);
      app.get("/test", (c) => {
        const data = [{ id: 1 }];
        const pagination = {
          page: 1,
          pageSize: 10,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        };
        return c.paginate(data, pagination);
      });

      const res = await app.request("/test");
      const json = await res.json();

      expect(json.pagination.hasNext).toBe(false);
      expect(json.pagination.hasPrev).toBe(false);
    });
  });
});
