/**
 * 小智端点处理器中间件
 * 负责创建和管理 MCPEndpointApiHandler 实例
 */

import type { IndependentXiaozhiConnectionManager } from "@/lib/endpoint/index.js";
import { MCPEndpointApiHandler } from "@handlers/MCPEndpointApiHandler.js";
import { configManager } from "@root/configManager.js";
import type { MiddlewareHandler } from "hono";
import type { AppContext } from "../types/hono.context.js";

/**
 * 小智端点处理器中间件
 * 创建单例的 MCPEndpointApiHandler 并注入到上下文中
 */
export const xiaozhiEndpointsMiddleware = (): MiddlewareHandler<AppContext> => {
  // 使用闭包缓存 handler 实例和 manager
  let endpointHandler: MCPEndpointApiHandler | null = null;
  let lastManager: IndependentXiaozhiConnectionManager | null | undefined =
    undefined;

  return async (c, next) => {
    const xiaozhiConnectionManager = c.get("xiaozhiConnectionManager");

    // 如果 manager 发生变化，则重建 handler
    // 注意：使用引用相等检查（!==）确保使用最新的 manager 实例
    // 即使 manager 内容相同，但对象引用不同时也会重建 handler
    // 这是期望的行为，确保 handler 总是使用最新的连接管理
    if (xiaozhiConnectionManager !== lastManager) {
      lastManager = xiaozhiConnectionManager;
      if (xiaozhiConnectionManager) {
        endpointHandler = new MCPEndpointApiHandler(
          xiaozhiConnectionManager,
          configManager
        );
      } else {
        endpointHandler = null;
      }
    }

    // 将 handler 注入到上下文中
    c.set("endpointHandler", endpointHandler);

    await next();
  };
};
