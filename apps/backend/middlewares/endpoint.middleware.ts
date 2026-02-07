/**
 * 端点中间件
 * 统一负责将 EndpointManager 和 EndpointHandler 注入到请求上下文中
 *
 * 合并了原 endpointManagerMiddleware 和 endpointsMiddleware 的功能：
 * - 从 WebServer 获取 EndpointManager 实例
 * - 创建并缓存 EndpointHandler 实例
 * - 同时注入两者到上下文中
 */

import { EndpointHandler } from "@/handlers/endpoint.handler.js";
import { configManager } from "@xiaozhi-client/config";
import type { EndpointManager } from "@xiaozhi-client/endpoint";
import type { MiddlewareHandler } from "hono";
import type { AppContext } from "../types/hono.context.js";

/**
 * 端点中间件
 * 统一管理 EndpointManager 和 EndpointHandler 的注入
 */
export const endpointMiddleware = (): MiddlewareHandler<AppContext> => {
  // 使用闭包缓存 handler 实例和 manager
  let endpointHandler: EndpointHandler | null = null;
  let lastManager: EndpointManager | null | undefined = undefined;

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

    let endpointManager: EndpointManager | null;

    try {
      endpointManager = webServer.getEndpointManager();
    } catch (error) {
      // 记录错误但不阻断请求
      if (error instanceof Error && error.message.includes("未初始化")) {
        console.warn("小智连接管理器未初始化，使用 null 值:", error.message);
        endpointManager = null;
      } else {
        throw error;
      }
    }

    // 注入 manager 到上下文
    c.set("endpointManager", endpointManager);

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
