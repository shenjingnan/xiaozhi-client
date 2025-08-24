/**
 * WebServer 类型定义测试
 * 测试接口定义的正确性和类型安全
 */

import { describe, expect, it } from "vitest";
import type {
  IMiddlewareManager,
  IRouteManager,
  IWebSocketManager,
  MessageHandler,
  MiddlewareHandler,
  RouteHandler,
  WebSocketErrorMessage,
  WebSocketMessage,
} from "./WebServerTypes.js";

describe("WebServerTypes", () => {
  describe("接口类型检查", () => {
    it("应该正确定义 RouteHandler 接口", () => {
      // 创建一个符合接口的对象
      const mockRouteHandler: RouteHandler = {
        register: (app) => {
          // Mock implementation
        },
      };

      expect(typeof mockRouteHandler.register).toBe("function");
    });

    it("应该正确定义 MessageHandler 接口", () => {
      const mockMessageHandler: MessageHandler = {
        canHandle: (messageType: string) => true,
        handle: async (ws, message) => {
          // Mock implementation
        },
      };

      expect(typeof mockMessageHandler.canHandle).toBe("function");
      expect(typeof mockMessageHandler.handle).toBe("function");
    });

    it("应该正确定义 IRouteManager 接口", () => {
      const mockRouteManager: IRouteManager = {
        registerRoutes: (app) => {
          // Mock implementation
        },
        addRouteHandler: (handler) => {
          // Mock implementation
        },
      };

      expect(typeof mockRouteManager.registerRoutes).toBe("function");
      expect(typeof mockRouteManager.addRouteHandler).toBe("function");
    });

    it("应该正确定义 IWebSocketManager 接口", () => {
      const mockWebSocketManager: IWebSocketManager = {
        setup: (server) => {
          // Mock implementation
        },
        broadcast: (message) => {
          // Mock implementation
        },
        handleConnection: (ws) => {
          // Mock implementation
        },
        addMessageHandler: (handler) => {
          // Mock implementation
        },
      };

      expect(typeof mockWebSocketManager.setup).toBe("function");
      expect(typeof mockWebSocketManager.broadcast).toBe("function");
      expect(typeof mockWebSocketManager.handleConnection).toBe("function");
      expect(typeof mockWebSocketManager.addMessageHandler).toBe("function");
    });
  });

  describe("消息类型定义", () => {
    it("应该正确定义 WebSocketMessage 接口", () => {
      const message: WebSocketMessage = {
        type: "test",
        data: { test: true },
        id: "123",
      };

      expect(message.type).toBe("test");
      expect(message.data).toEqual({ test: true });
      expect(message.id).toBe("123");
    });

    it("应该正确定义 WebSocketErrorMessage 接口", () => {
      const errorMessage: WebSocketErrorMessage = {
        type: "error",
        error: "Test error message",
      };

      expect(errorMessage.type).toBe("error");
      expect(errorMessage.error).toBe("Test error message");
    });
  });

  describe("中间件接口定义", () => {
    it("应该正确定义 MiddlewareHandler 接口", () => {
      const mockMiddlewareHandler: MiddlewareHandler = {
        getName: () => "test-middleware",
        register: (app) => {
          // Mock implementation
        },
      };

      expect(typeof mockMiddlewareHandler.getName).toBe("function");
      expect(typeof mockMiddlewareHandler.register).toBe("function");
      expect(mockMiddlewareHandler.getName()).toBe("test-middleware");
    });

    it("应该正确定义 IMiddlewareManager 接口", () => {
      const mockMiddlewareManager: IMiddlewareManager = {
        registerMiddleware: (app) => {
          // Mock implementation
        },
        addMiddlewareHandler: (handler) => {
          // Mock implementation
        },
      };

      expect(typeof mockMiddlewareManager.registerMiddleware).toBe("function");
      expect(typeof mockMiddlewareManager.addMiddlewareHandler).toBe(
        "function"
      );
    });
  });
});
