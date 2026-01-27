import type { Logger } from "@root/Logger.js";
import type { Context } from "hono";

/**
 * 抽象 API Handler 基类
 * 提供统一的 Logger 获取方法和便捷的响应方法
 */
export abstract class BaseHandler {
  /**
   * 从 context 获取 logger 实例
   * @param c - Hono context
   * @returns Logger 实例
   * @throws Error 如果 logger 未在 context 中设置
   */
  protected getLogger(c: Context): Logger {
    const logger = c.get("logger");
    if (!logger) {
      throw new Error(
        "Logger not found in context. Ensure loggerMiddleware is registered."
      );
    }
    return logger as Logger;
  }

  /**
   * 返回成功响应（Context.success 的包装器）
   * @param c - Hono context
   * @param data - 响应数据
   * @param message - 响应消息
   * @param status - HTTP 状态码（默认 200）
   * @returns JSON 响应
   */
  protected success<T>(
    c: Context,
    data?: T,
    message?: string,
    status?: number
  ): Response {
    // 只有当 status 明确指定时才传递，否则使用默认值
    return status !== undefined
      ? c.success(data, message, status)
      : c.success(data, message);
  }

  /**
   * 返回错误响应（Context.fail 的包装器）
   * @param c - Hono context
   * @param code - 错误码
   * @param message - 错误消息
   * @param details - 错误详情
   * @param statusCode - HTTP 状态码（默认 400）
   * @returns JSON 响应
   */
  protected fail(
    c: Context,
    code: string,
    message: string,
    details?: unknown,
    statusCode?: number
  ): Response {
    return c.fail(code, message, details, statusCode);
  }

  /**
   * 统一错误处理方法
   * 记录错误日志并返回格式化的错误响应
   * @param c - Hono context
   * @param error - 错误对象
   * @param operation - 操作描述（用于日志）
   * @param defaultCode - 默认错误码
   * @param defaultMessage - 默认错误消息
   * @param statusCode - HTTP 状态码（默认 500）
   * @returns JSON 错误响应
   */
  protected handleError(
    c: Context,
    error: unknown,
    operation: string,
    defaultCode = "OPERATION_FAILED",
    defaultMessage = "操作失败",
    statusCode = 500
  ): Response {
    const logger = this.getLogger(c);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode =
      error instanceof Error && "code" in error
        ? String((error as { code: unknown }).code)
        : defaultCode;

    logger.error(`${operation}失败:`, error);

    return this.fail(
      c,
      errorCode,
      errorMessage || defaultMessage,
      undefined,
      statusCode
    );
  }

  /**
   * 解析 JSON 请求体
   * @param c - Hono context
   * @param errorMessage - 自定义错误消息前缀（默认"请求体格式错误"）
   * @returns 解析后的 JSON 对象
   * @throws 如果请求体不是有效的 JSON
   */
  protected async parseJsonBody<T>(
    c: Context,
    errorMessage = "请求体格式错误"
  ): Promise<T> {
    try {
      return await c.req.json();
    } catch (error) {
      // 保留原始错误信息
      const message =
        error instanceof Error
          ? `${errorMessage}: ${error.message}`
          : errorMessage;
      throw new Error(message);
    }
  }
}
