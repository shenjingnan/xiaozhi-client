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

  loggerInstance.error("HTTP request error:", err);
  const errorResponse = createErrorResponse(
    "INTERNAL_SERVER_ERROR",
    "服务器内部错误",
    process.env.NODE_ENV === "development" ? err.stack : undefined
  );
  return c.json(errorResponse, 500);
};
