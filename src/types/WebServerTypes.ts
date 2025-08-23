/**
 * WebServer 相关类型定义
 * 定义了重构后架构中的核心接口和类型
 */

import type { Hono } from "hono";
import type { WebSocket } from "ws";

/**
 * 路由处理器接口
 * 所有路由处理器都必须实现此接口
 */
export interface RouteHandler {
  /**
   * 注册路由到 Hono 应用实例
   * @param app Hono 应用实例
   */
  register(app: Hono): void;
}

/**
 * WebSocket 消息处理器接口
 * 所有 WebSocket 消息处理器都必须实现此接口
 */
export interface MessageHandler {
  /**
   * 判断是否可以处理指定类型的消息
   * @param messageType 消息类型
   * @returns 是否可以处理
   */
  canHandle(messageType: string): boolean;

  /**
   * 处理 WebSocket 消息
   * @param ws WebSocket 连接实例
   * @param message 消息对象
   */
  handle(ws: WebSocket, message: any): Promise<void>;
}

/**
 * 路由管理器接口
 * 负责管理和注册所有路由处理器
 */
export interface IRouteManager {
  /**
   * 注册所有路由到 Hono 应用实例
   * @param app Hono 应用实例
   */
  registerRoutes(app: Hono): void;

  /**
   * 添加路由处理器
   * @param handler 路由处理器实例
   */
  addRouteHandler(handler: RouteHandler): void;
}

/**
 * WebSocket 管理器接口
 * 负责管理 WebSocket 连接和消息处理
 */
export interface IWebSocketManager {
  /**
   * 设置 WebSocket 服务器
   * @param server HTTP 服务器实例
   */
  setup(server: any): void;

  /**
   * 广播消息给所有连接的客户端
   * @param message 要广播的消息
   */
  broadcast(message: any): void;

  /**
   * 处理新的 WebSocket 连接
   * @param ws WebSocket 连接实例
   */
  handleConnection(ws: WebSocket): void;

  /**
   * 添加消息处理器
   * @param handler 消息处理器实例
   */
  addMessageHandler(handler: MessageHandler): void;
}

/**
 * WebSocket 消息基础类型
 */
export interface WebSocketMessage {
  type: string;
  data?: any;
  id?: string;
}

/**
 * WebSocket 错误消息类型
 */
export interface WebSocketErrorMessage extends WebSocketMessage {
  type: "error";
  error: string;
}

/**
 * 中间件处理器接口
 */
export interface MiddlewareHandler {
  /**
   * 获取中间件名称
   */
  getName(): string;

  /**
   * 注册中间件到 Hono 应用实例
   * @param app Hono 应用实例
   */
  register(app: Hono): void;
}

/**
 * 中间件管理器接口
 */
export interface IMiddlewareManager {
  /**
   * 注册所有中间件到 Hono 应用实例
   * @param app Hono 应用实例
   */
  registerMiddleware(app: Hono): void;

  /**
   * 添加中间件处理器
   * @param handler 中间件处理器实例
   */
  addMiddlewareHandler(handler: MiddlewareHandler): void;
}
