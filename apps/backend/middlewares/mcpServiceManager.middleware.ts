/**
 * MCP Service Manager 中间件
 * 将 MCPServiceManager 实例注入到 Hono Context 中
 * 提供统一的依赖注入模式，替代直接使用 Singleton
 */

import { logger } from "@root/Logger.js";
import type { MCPServiceManager } from "@services/MCPServiceManager.js";
import { MCPServiceManagerSingleton } from "@services/MCPServiceManagerSingleton.js";
import type { Context, Next } from "hono";

/**
 * MCP Service Manager 中间件
 *
 * 功能：
 * 1. 将 MCPServiceManager 实例注入到 Hono Context
 * 2. 确保实例只初始化一次
 * 3. 提供错误处理和日志记录
 * 4. 与现有 Singleton 模式兼容
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
      logger.debug("[MCPMiddleware] 正在初始化 MCPServiceManager 实例");

      // 通过 Singleton 获取实例（保持兼容性）
      const serviceManager = await MCPServiceManagerSingleton.getInstance();

      // 将实例注入到 Context
      c.set("mcpServiceManager", serviceManager);

      logger.debug(
        "[MCPMiddleware] MCPServiceManager 实例已成功注入到 Context"
      );
    } catch (error) {
      // 记录错误但不阻断请求处理
      logger.error("[MCPMiddleware] 初始化 MCPServiceManager 失败:", error);

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
  return c.get("mcpServiceManager") !== undefined;
};

/**
 * 从 Context 中获取 MCPServiceManager 实例
 *
 * @param c Hono Context
 * @returns MCPServiceManager 实例或 undefined
 */
export const getMCPServiceManager = (
  c: Context
): MCPServiceManager | undefined => {
  return c.get("mcpServiceManager");
};

/**
 * 从 Context 中安全获取 MCPServiceManager 实例
 * 如果实例不存在，抛出错误
 *
 * @param c Hono Context
 * @returns MCPServiceManager 实例
 * @throws Error 如果实例不存在
 */
export const requireMCPServiceManager = (c: Context): MCPServiceManager => {
  const serviceManager = c.get("mcpServiceManager");

  if (!serviceManager) {
    throw new Error(
      "MCPServiceManager 未初始化，请检查 mcpServiceManagerMiddleware 是否正确配置"
    );
  }

  return serviceManager;
};
