/**
 * 小智连接管理器中间件
 * 负责将 endpointManager 注入到请求上下文中
 */

import type { MiddlewareHandler } from "hono";
import type { AppContext } from "../types/hono.context.js";

/**
 * 小智连接管理器中间件
 * 从 WebServer 实例获取连接管理器并注入到上下文中
 */
export const endpointManagerMiddleware = (): MiddlewareHandler<AppContext> => {
  return async (c, next) => {
    // 从 WebServer 实例获取连接管理器
    const webServer = c.get("webServer");
    if (!webServer) {
      throw new Error(
        "WebServer 实例未注入到上下文中，请确保 webServerMiddleware 已正确配置"
      );
    }

    if (!webServer.getEndpointManager) {
      throw new Error("WebServer 实例缺少 getEndpointManager 方法");
    }

    try {
      const connectionManager = webServer.getEndpointManager();
      c.set("endpointManager", connectionManager);
    } catch (error) {
      // 记录错误但不阻断请求
      if (error instanceof Error && error.message.includes("未初始化")) {
        console.warn("小智连接管理器未初始化，使用 null 值:", error.message);
        c.set("endpointManager", null);
      } else {
        throw error;
      }
    }

    await next();
  };
};
