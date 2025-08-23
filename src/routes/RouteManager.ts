/**
 * 路由管理器实现
 * 负责管理和注册所有路由处理器
 */

import type { Hono } from "hono";
import { logger } from "../Logger.js";
import type { IRouteManager, RouteHandler } from "../types/WebServerTypes.js";

/**
 * 路由管理器实现类
 */
export class RouteManager implements IRouteManager {
  private handlers: RouteHandler[] = [];

  /**
   * 添加路由处理器
   * @param handler 路由处理器实例
   */
  addRouteHandler(handler: RouteHandler): void {
    if (!handler) {
      throw new Error("路由处理器不能为空");
    }

    this.handlers.push(handler);
    logger.debug(`已添加路由处理器: ${handler.constructor.name}`);
  }

  /**
   * 注册所有路由到 Hono 应用实例
   * @param app Hono 应用实例
   */
  registerRoutes(app: Hono): void {
    if (!app) {
      throw new Error("Hono 应用实例不能为空");
    }

    logger.info(`开始注册 ${this.handlers.length} 个路由处理器`);

    for (const handler of this.handlers) {
      try {
        handler.register(app);
        logger.debug(`路由处理器注册成功: ${handler.constructor.name}`);
      } catch (error) {
        logger.error(`路由处理器注册失败: ${handler.constructor.name}`, error);
        throw error;
      }
    }

    logger.info("所有路由处理器注册完成");
  }

  /**
   * 获取已注册的路由处理器数量
   * @returns 处理器数量
   */
  getHandlerCount(): number {
    return this.handlers.length;
  }

  /**
   * 清空所有路由处理器
   */
  clearHandlers(): void {
    this.handlers = [];
    logger.debug("已清空所有路由处理器");
  }

  /**
   * 检查是否包含指定类型的路由处理器
   * @param handlerClass 处理器类构造函数
   * @returns 是否包含
   */
  hasHandler(handlerClass: new (...args: any[]) => RouteHandler): boolean {
    return this.handlers.some((handler) => handler instanceof handlerClass);
  }
}
