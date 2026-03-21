/**
 * 小智连接管理器中间件
 * 负责将 endpointManager 注入到请求上下文中
 */

import {
  EndpointManagerNotInitializedError,
  WebServerNotAvailableError,
} from "@/errors/mcp-errors.middleware.js";
import type { AppContext } from "@/types/hono.context.js";
import type { MiddlewareHandler } from "hono";

/**
 * 小智连接管理器中间件
 * 从 WebServer 实例获取连接管理器并注入到上下文中
 *
 * 保持与 mcpServiceManagerMiddleware 一致的实现模式：
 * - 使用特定错误类（EndpointManagerNotInitializedError）
 * - 统一的错误处理逻辑
 * - 统一的日志格式
 * - 检查是否已注入，避免重复初始化
 */
export const endpointManagerMiddleware = (): MiddlewareHandler<AppContext> => {
  return async (c, next) => {
    // 检查是否已经注入，避免重复初始化
    if (!c.get("endpointManager")) {
      try {
        c.logger.debug(
          "[EndpointMiddleware] 正在从 WebServer 获取 endpointManager 实例"
        );

        // 从 WebServer 获取实例
        const webServer = c.get("webServer");
        if (!webServer) {
          throw new WebServerNotAvailableError("WebServer 未注入到 Context");
        }

        // 检查方法是否存在
        if (!webServer.getEndpointManager) {
          throw new Error("WebServer 实例缺少 getEndpointManager 方法");
        }

        const connectionManager = webServer.getEndpointManager();

        // 将实例注入到 Context
        c.set("endpointManager", connectionManager);

        c.logger.debug(
          "[EndpointMiddleware] endpointManager 实例已成功注入到 Context"
        );
      } catch (error) {
        // 根据错误类型进行不同的处理
        if (error instanceof EndpointManagerNotInitializedError) {
          // EndpointManager 未初始化，设置 null 值
          c.logger.warn(
            "[EndpointMiddleware] endpointManager 未初始化，使用 null 值:",
            error.message
          );
          c.set("endpointManager", null);
        } else if (error instanceof WebServerNotAvailableError) {
          // WebServer 未注入是配置错误，应该抛出
          c.logger.error(
            "[EndpointMiddleware] WebServer 配置错误:",
            error.message
          );
          throw error;
        } else {
          // 其他未知错误，记录并抛出
          c.logger.error(
            "[EndpointMiddleware] 获取 endpointManager 时发生未知错误:",
            error
          );
          throw error;
        }
      }
    }

    await next();
  };
};
