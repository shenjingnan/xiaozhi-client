/**
 * 小智端点处理器中间件
 * 负责创建和管理 MCPEndpointApiHandler 实例
 */

import { MCPEndpointApiHandler } from "@handlers/MCPEndpointApiHandler.js";
import { configManager } from "@root/configManager.js";
import type { MiddlewareHandler } from "hono";
import type { AppContext } from "../types/hono.context.js";

/**
 * 小智端点处理器中间件
 * 创建单例的 MCPEndpointApiHandler 并注入到上下文中
 */
export const xiaozhiEndpointsMiddleware = (): MiddlewareHandler<AppContext> => {
  // 使用闭包缓存 handler 实例
  let endpointHandler: MCPEndpointApiHandler | null = null;

  return async (c, next) => {
    const xiaozhiConnectionManager = c.get("xiaozhiConnectionManager");

    // 如果连接管理器可用且 handler 未创建，则创建 handler
    if (xiaozhiConnectionManager && !endpointHandler) {
      endpointHandler = new MCPEndpointApiHandler(
        xiaozhiConnectionManager,
        configManager
      );
    }

    // 将 handler 注入到上下文中
    c.set("endpointHandler", endpointHandler);

    await next();
  };
};
