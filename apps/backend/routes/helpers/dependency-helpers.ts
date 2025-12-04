/**
 * 路由依赖注入辅助函数
 * 提供统一的依赖获取和错误处理逻辑
 */

import type { MCPEndpointApiHandler } from "@handlers/index.js";
import type { Context } from "hono";
import { createErrorResponse } from "../../middlewares/error.middleware.js";
import type { HandlerDependencies } from "../types.js";

/**
 * 获取端点处理器或返回错误响应
 * 统一处理端点路由的错误检查逻辑
 * @param c - Hono context 对象
 * @returns 端点处理器实例或错误响应
 */
export function getEndpointHandlerOrError(
  c: Context
): MCPEndpointApiHandler | Response {
  const endpointHandler = c.get("endpointHandler") as MCPEndpointApiHandler;

  if (!endpointHandler) {
    const errorResponse = createErrorResponse(
      "CONNECTION_MANAGER_NOT_AVAILABLE",
      "连接管理器未初始化"
    );
    return c.json(errorResponse, 503);
  }

  return endpointHandler;
}

/**
 * 安全地从 context 获取指定的处理器
 * 提供统一的依赖获取方式
 * @param c - Hono context 对象
 * @param key - 处理器的键名
 * @returns 处理器实例
 */
export function getHandler<T extends keyof HandlerDependencies>(
  c: Context,
  key: T
): NonNullable<HandlerDependencies[T]> {
  const dependencies = c.get("dependencies") as HandlerDependencies;
  const handler = dependencies[key];

  if (!handler) {
    throw new Error(`Handler '${String(key)}' not found in dependencies`);
  }

  return handler as NonNullable<HandlerDependencies[T]>;
}
