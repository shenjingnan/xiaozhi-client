/**
 * Hono Context 类型扩展
 * 为 Hono Context 添加项目特定的变量类型定义
 */

import type { MCPServiceManager } from "@/lib/mcp";
import type { Logger } from "@root/Logger.js";
import type { Context } from "hono";
import { Hono } from "hono";

/**
 * 扩展 Hono Context 的 Variables 类型
 * 定义了项目中所有通过中间件注入的变量
 */
export type AppContextVariables = {
  /**
   * 日志记录器实例
   * 由 loggerMiddleware 注入
   */
  logger?: Logger;

  /**
   * MCP 服务管理器实例
   * 由 mcpServiceManagerMiddleware 注入
   */
  mcpServiceManager?: MCPServiceManager;
};

/**
 * 扩展的 Hono Context 类型
 * 包含项目中所有自定义变量
 */
export type AppContext = {
  Variables: AppContextVariables;
};

/**
 * 创建类型化的 Hono 实例
 * 使用这个类型来创建新的 Hono 应用，确保 Context 类型安全
 */
export const createApp = (): Hono<AppContext> => {
  return new Hono<AppContext>();
};

/**
 * 从 Context 中获取日志记录器的类型安全方法
 */
export const getLogger = (c: Context<AppContext>): Logger | undefined => {
  return c.get("logger");
};

/**
 * 从 Context 中获取 MCPServiceManager 的类型安全方法
 */
export const getMCPServiceManager = (
  c: Context<AppContext>
): MCPServiceManager | undefined => {
  return c.get("mcpServiceManager");
};

/**
 * 要求必须存在 MCPServiceManager 的类型安全方法
 */
export const requireMCPServiceManager = (
  c: Context<AppContext>
): MCPServiceManager => {
  const serviceManager = c.get("mcpServiceManager");

  if (!serviceManager) {
    throw new Error(
      "MCPServiceManager 未初始化，请检查 mcpServiceManagerMiddleware 是否正确配置"
    );
  }

  return serviceManager;
};
