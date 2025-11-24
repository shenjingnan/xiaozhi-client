import { logger } from "@root/Logger.js";
import type { Context } from "hono";

// 统一错误响应格式
interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
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
 * 错误处理中间件
 */
export const errorHandlerMiddleware = (err: Error, c: Context) => {
  logger.error("HTTP request error:", err);
  const errorResponse = createErrorResponse(
    "INTERNAL_SERVER_ERROR",
    "服务器内部错误",
    process.env.NODE_ENV === "development" ? err.stack : undefined
  );
  return c.json(errorResponse, 500);
};
