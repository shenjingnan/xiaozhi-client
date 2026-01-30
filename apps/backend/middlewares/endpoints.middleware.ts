/**
 * 小智端点处理器中间件
 * 负责创建和管理 EndpointHandler 实例
 */

import { EndpointHandler } from "@/handlers/endpoint.handler.js";
import { configManager } from "@xiaozhi-client/config";
import type { EndpointManager } from "@xiaozhi-client/endpoint";
import type { MiddlewareHandler } from "hono";
import type { AppContext } from "../types/hono.context.js";

/**
 * 小智端点处理器中间件
 * 创建单例的 EndpointHandler 并注入到上下文中
 */
export const endpointsMiddleware = (): MiddlewareHandler<AppContext> => {
  // 使用闭包缓存 handler 实例和 manager
  let endpointHandler: EndpointHandler | null = null;
  let lastManager: EndpointManager | null | undefined = undefined;

  return async (c, next) => {
    const endpointManager = c.get("endpointManager");

    // 如果 manager 发生变化，则重建 handler
    // 注意：使用引用相等检查（!==）确保使用最新的 manager 实例
    // 即使 manager 内容相同，但对象引用不同时也会重建 handler
    // 这是期望的行为，确保 handler 总是使用最新的连接管理
    if (endpointManager !== lastManager) {
      lastManager = endpointManager;
      if (endpointManager) {
        endpointHandler = new EndpointHandler(endpointManager, configManager);
      } else {
        endpointHandler = null;
      }
    }

    // 将 handler 注入到上下文中
    c.set("endpointHandler", endpointHandler);

    await next();
  };
};
