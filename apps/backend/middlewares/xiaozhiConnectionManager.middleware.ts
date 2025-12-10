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
      if (!webServer) {
        throw new Error(
          "WebServer 实例未注入到上下文中，请确保 webServerMiddleware 已正确配置"
        );
      }

      if (!webServer.getXiaozhiConnectionManager) {
        throw new Error(
          "WebServer 实例缺少 getXiaozhiConnectionManager 方法"
        );
      }

      try {
        const connectionManager = webServer.getXiaozhiConnectionManager();
        c.set("xiaozhiConnectionManager", connectionManager);
      } catch (error) {
        if (error instanceof Error && error.message.includes("未初始化")) {
          throw new Error(
            "小智连接管理器未初始化，请确保 WebServer 已完全启动"
          );
        }
        throw error;
      }

      await next();
    };
  };
