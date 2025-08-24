/**
 * RouteManager 测试
 * 测试路由管理器的功能
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RouteHandler } from "../types/WebServerTypes.js";
import { RouteManager } from "./RouteManager.js";

// Mock logger
vi.mock("../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("RouteManager", () => {
  let routeManager: RouteManager;
  let mockApp: any;
  let mockHandler: RouteHandler;

  beforeEach(() => {
    routeManager = new RouteManager();
    mockApp = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    };
    mockHandler = {
      register: vi.fn(),
    };
  });

  describe("构造函数", () => {
    it("应该创建一个空的路由管理器", () => {
      expect(routeManager.getHandlerCount()).toBe(0);
    });
  });

  describe("addRouteHandler", () => {
    it("应该成功添加路由处理器", () => {
      routeManager.addRouteHandler(mockHandler);
      expect(routeManager.getHandlerCount()).toBe(1);
    });

    it("应该在添加空处理器时抛出错误", () => {
      expect(() => {
        routeManager.addRouteHandler(null as any);
      }).toThrow("路由处理器不能为空");
    });

    it("应该能够添加多个路由处理器", () => {
      const handler1 = { register: vi.fn() };
      const handler2 = { register: vi.fn() };

      routeManager.addRouteHandler(handler1);
      routeManager.addRouteHandler(handler2);

      expect(routeManager.getHandlerCount()).toBe(2);
    });
  });

  describe("registerRoutes", () => {
    it("应该成功注册所有路由处理器", () => {
      routeManager.addRouteHandler(mockHandler);
      routeManager.registerRoutes(mockApp);

      expect(mockHandler.register).toHaveBeenCalledWith(mockApp);
      expect(mockHandler.register).toHaveBeenCalledTimes(1);
    });

    it("应该在 app 为空时抛出错误", () => {
      expect(() => {
        routeManager.registerRoutes(null as any);
      }).toThrow("Hono 应用实例不能为空");
    });

    it("应该在处理器注册失败时抛出错误", () => {
      const errorHandler = {
        register: vi.fn().mockImplementation(() => {
          throw new Error("注册失败");
        }),
      };

      routeManager.addRouteHandler(errorHandler);

      expect(() => {
        routeManager.registerRoutes(mockApp);
      }).toThrow("注册失败");
    });

    it("应该注册多个路由处理器", () => {
      const handler1 = { register: vi.fn() };
      const handler2 = { register: vi.fn() };

      routeManager.addRouteHandler(handler1);
      routeManager.addRouteHandler(handler2);
      routeManager.registerRoutes(mockApp);

      expect(handler1.register).toHaveBeenCalledWith(mockApp);
      expect(handler2.register).toHaveBeenCalledWith(mockApp);
    });
  });

  describe("clearHandlers", () => {
    it("应该清空所有路由处理器", () => {
      routeManager.addRouteHandler(mockHandler);
      expect(routeManager.getHandlerCount()).toBe(1);

      routeManager.clearHandlers();
      expect(routeManager.getHandlerCount()).toBe(0);
    });
  });

  describe("hasHandler", () => {
    class TestHandler implements RouteHandler {
      register() {}
    }

    it("应该正确检测是否包含指定类型的处理器", () => {
      const handler = new TestHandler();
      routeManager.addRouteHandler(handler);

      expect(routeManager.hasHandler(TestHandler)).toBe(true);
    });

    it("应该在不包含指定类型处理器时返回 false", () => {
      expect(routeManager.hasHandler(TestHandler)).toBe(false);
    });
  });

  describe("getHandlerCount", () => {
    it("应该返回正确的处理器数量", () => {
      expect(routeManager.getHandlerCount()).toBe(0);

      routeManager.addRouteHandler(mockHandler);
      expect(routeManager.getHandlerCount()).toBe(1);

      routeManager.addRouteHandler({ register: vi.fn() });
      expect(routeManager.getHandlerCount()).toBe(2);
    });
  });
});
