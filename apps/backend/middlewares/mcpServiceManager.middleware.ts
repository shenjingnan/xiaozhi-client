/**
 * MCP Service Manager 中间件
 * 将 MCPServiceManager 实例注入到 Hono Context 中
 * 提供统一的依赖注入模式，从 WebServer 获取实例而非 Singleton
 */

import type { Context, Next } from "hono";
import {
  MCPServiceManagerNotInitializedError,
  WebServerNotAvailableError,
} from "../errors/MCPErrors.middleware.js";
import type { AppContextVariables } from "../types/hono.context.js";

/**
 * MCP Service Manager 中间件
 *
 * 功能：
 * 1. 从 WebServer 获取 MCPServiceManager 实例
 * 2. 将实例注入到 Hono Context
 * 3. 提供错误处理和日志记录
 * 4. 与 WebServer 生命周期绑定
 * 5. 使用 Hono Context 中的 logger 实现统一的日志配置
 *
 * @param c Hono Context
 * @param next 下一个中间件函数
 */
export const mcpServiceManagerMiddleware = async (
  c: Context<{ Variables: AppContextVariables }>,
  next: Next
): Promise<void> => {
  // 检查是否已经注入，避免重复初始化
  if (!c.get("mcpServiceManager")) {
    try {
      c.logger.debug(
        "[MCPMiddleware] 正在从 WebServer 获取 MCPServiceManager 实例"
      );

      // 从 WebServer 获取实例
      const webServer = c.get("webServer");
      if (!webServer) {
        throw new WebServerNotAvailableError("WebServer 未注入到 Context");
      }

      const serviceManager = webServer.getMCPServiceManager();

      // 将实例注入到 Context
      c.set("mcpServiceManager", serviceManager);

      c.logger.debug(
        "[MCPMiddleware] MCPServiceManager 实例已成功注入到 Context"
      );
    } catch (error) {
      // 根据错误类型进行不同的处理
      if (error instanceof MCPServiceManagerNotInitializedError) {
        // MCPServiceManager 未初始化是临时状态，允许通过
        c.logger.debug(
          "[MCPMiddleware] MCPServiceManager 尚未初始化，允许通过"
        );
        // 不设置实例，Handler 中需要处理未初始化的情况
      } else if (error instanceof WebServerNotAvailableError) {
        // WebServer 未注入是配置错误，应该抛出
        c.logger.error("[MCPMiddleware] WebServer 配置错误:", error.message);
        throw error;
      } else {
        // 其他未知错误，记录并抛出
        c.logger.error(
          "[MCPMiddleware] 获取 MCPServiceManager 时发生未知错误:",
          error
        );
        throw error;
      }
    }
  }

  await next();
};

/**
 * 类型守卫：检查 Context 中是否存在 MCPServiceManager 实例
 *
 * @param c Hono Context
 * @returns 是否存在 MCPServiceManager 实例
 */
export const hasMCPServiceManager = (
  c: Context<{ Variables: AppContextVariables }>
): boolean => {
  return c.get("mcpServiceManager") !== undefined;
};
