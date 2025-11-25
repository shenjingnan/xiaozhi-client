/**
 * MCP Service Manager 中间件
 * 将 MCPServiceManager 实例注入到 Hono Context 中
 * 提供统一的依赖注入模式，替代直接使用 Singleton
 */

import { logger } from "@root/Logger.js";
import { MCPServiceManagerSingleton } from "@services/MCPServiceManagerSingleton.js";
import type { Context, Next } from "hono";
import { getMCPServiceManager } from "../types/hono.context.js";

/**
 * MCP Service Manager 中间件
 *
 * 功能：
 * 1. 将 MCPServiceManager 实例注入到 Hono Context
 * 2. 确保实例只初始化一次
 * 3. 提供错误处理和日志记录
 * 4. 与现有 Singleton 模式兼容
 * 5. 使用 Hono Context 中的 logger 实现统一的日志配置
 *
 * @param c Hono Context
 * @param next 下一个中间件函数
 */
export const mcpServiceManagerMiddleware = async (
  c: Context,
  next: Next
): Promise<void> => {
  // 检查是否已经注入，避免重复初始化
  if (!c.get("mcpServiceManager")) {
    try {
      // 尝试从 Context 获取 logger，如果不存在则使用全局 logger
      const contextLogger = c.get("logger") || logger;

      contextLogger.debug("[MCPMiddleware] 正在初始化 MCPServiceManager 实例");

      // 通过 Singleton 获取实例，传入 Context 中的 logger
      const serviceManager =
        await MCPServiceManagerSingleton.getInstance(contextLogger);

      // 将实例注入到 Context
      c.set("mcpServiceManager", serviceManager);

      contextLogger.debug(
        "[MCPMiddleware] MCPServiceManager 实例已成功注入到 Context"
      );
    } catch (error) {
      // 记录错误但不阻断请求处理
      const errorLogger = c.get("logger") || logger;
      errorLogger.error(
        "[MCPMiddleware] 初始化 MCPServiceManager 失败:",
        error
      );

      // 不设置实例，Handler 中需要处理未初始化的情况
      // 这样可以确保应用其他功能仍然可用
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
export const hasMCPServiceManager = (c: Context): boolean => {
  return getMCPServiceManager(c) !== undefined;
};
