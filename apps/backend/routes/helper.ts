/**
 * 路由辅助函数
 * 提供路由系统中使用的辅助功能
 */

import type { MCPEndpointApiHandler } from "@handlers/index.js";
import type { Context } from "hono";
import { createErrorResponse } from "../middlewares/error.middleware.js";

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
