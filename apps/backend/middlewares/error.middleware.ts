import { logger } from "@root/Logger.js";
import type { Logger } from "@root/Logger.js";
import type { Context } from "hono";

// 统一错误响应格式
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface ApiSuccessResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

/**
 * 创建统一的错误响应
 * @deprecated 请使用 c.fail() 方法代替
 */
export const createErrorResponse = (
  code: string,
  message: string,
  details?: unknown
): ApiErrorResponse => {
  return {
    error: {
      code,
      message,
      details,
    },
  };
};

/**
 * 创建统一的成功响应
 * @deprecated 请使用 c.success() 方法代替
 */
export const createSuccessResponse = <T>(
  data?: T,
  message?: string
): ApiSuccessResponse<T> => {
  return {
    success: true,
    data,
    message,
  };
};

/**
 * 错误处理中间件
 */
export const errorHandlerMiddleware = (err: Error, c: Context) => {
  // 尝试从 context 获取 logger，如果失败则使用全局 logger
  let loggerInstance: Logger;
  try {
    const contextLogger = c.get("logger");
    if (contextLogger) {
      loggerInstance = contextLogger as Logger;
    } else {
      loggerInstance = logger;
    }
  } catch {
    // 如果无法从 context 获取，使用全局 logger
    loggerInstance = logger;
  }

  // 在开发环境中打印详细错误信息
  if (process.env.NODE_ENV === "development") {
    console.error("HTTP Request Error:", {
      error: err.message,
      stack: err.stack,
      path: c.req.path,
      method: c.req.method,
    });
  }

  loggerInstance.error("HTTP request error:", err);
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
