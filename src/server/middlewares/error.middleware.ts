/**
 * 错误处理中间件
 *
 * 提供：
 * - errorHandlerMiddleware: 全局错误处理中间件
 * - notFoundHandlerMiddleware: 404 处理中间件
 *
 * @module middlewares/error.middleware
 */

import type { Context } from "hono";

/**
 * 错误处理中间件
 */
export const errorHandlerMiddleware = (err: Error, c: Context) => {
  // 使用 Context 上的 logger 属性
  c.logger.error("HTTP request error:", err);

  // 在开发环境中打印详细错误信息
  if (process.env.NODE_ENV === "development") {
    console.error("HTTP Request Error:", {
      error: err.message,
      stack: err.stack,
      path: c.req.path,
      method: c.req.method,
    });
  }

  return c.fail(
    "INTERNAL_SERVER_ERROR",
    "服务器内部错误",
    process.env.NODE_ENV === "development" ? err.stack : undefined,
    500
  );
};

/**
 * 404 Not Found 处理中间件
 */
export const notFoundHandlerMiddleware = (c: Context) => {
  // 如果是 API 路径，返回 API_NOT_FOUND
  if (c.req.path.startsWith("/api/")) {
    return c.fail(
      "API_NOT_FOUND",
      "请求的资源不存在",
      {
        path: c.req.path,
        method: c.req.method,
      },
      404
    );
  }

  // 非 API 路径返回通用的 NOT_FOUND
  return c.fail(
    "NOT_FOUND",
    "请求的资源不存在",
    {
      path: c.req.path,
      method: c.req.method,
    },
    404
  );
};
