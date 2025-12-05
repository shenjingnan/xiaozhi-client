/**
 * 小智连接管理器中间件
 * 负责将 xiaozhiConnectionManager 注入到请求上下文中
 */

import type { MiddlewareHandler } from "hono";
import type { AppContext } from "../types/hono.context.js";

/**
 * 小智连接管理器中间件
 * 从 WebServer 实例获取连接管理器并注入到上下文中
 */
export const xiaozhiConnectionManagerMiddleware =
  (): MiddlewareHandler<AppContext> => {
    return async (c, next) => {
      // 从 WebServer 实例获取连接管理器
      const webServer = c.get("webServer");
      if (webServer?.getXiaozhiConnectionManager) {
        const connectionManager = webServer.getXiaozhiConnectionManager();
        c.set("xiaozhiConnectionManager", connectionManager);
      }
      await next();
    };
  };
