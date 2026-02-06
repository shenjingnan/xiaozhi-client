/**
 * 小智端点处理器中间件
 * 负责创建 EndpointHandler 实例并注入到 Context 中
 * 使用 Context-based 依赖注入模式，Handler 从 Context 获取依赖
 */

import { EndpointHandler } from "@/handlers/endpoint.handler.js";
import type { MiddlewareHandler } from "hono";
import type { AppContext } from "../types/hono.context.js";

/**
 * 小智端点处理器中间件
 * 创建单例的 EndpointHandler 并注入到上下文中
 * Handler 使用 Context-based 模式，从 Context 获取 EndpointManager 和 ConfigManager
 */
export const endpointsMiddleware = (): MiddlewareHandler<AppContext> => {
  // 使用闭包缓存 handler 实例
  let endpointHandler: EndpointHandler | null = null;

  return async (c, next) => {
    // 懒创建 handler 实例（仅创建一次）
    if (!endpointHandler) {
      endpointHandler = new EndpointHandler();
    }

    // 将 handler 注入到上下文中
    c.set("endpointHandler", endpointHandler);

    await next();
  };
};
