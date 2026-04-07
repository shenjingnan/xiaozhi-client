/**
 * 抽象 API Handler 基类
 * 提供便捷的辅助方法
 * logger 通过 c.get("logger") 访问（Hono 推荐做法）
 */
import type { AppContext } from "@/types/hono.context.js";
import type { Context } from "hono";

export abstract class BaseHandler {
  /**
   * 统一错误处理方法
   * 记录错误日志并返回格式化的错误响应
   * @param c - Hono context
   * @param error - 错误对象
   * @param operation - 操作描述（用于日志）
   * @param defaultCode - 默认错误码
   * @param defaultMessage - 默认错误消息（可选）
   * @param statusCode - HTTP 状态码（默认 500）
   * @returns JSON 错误响应
   */
  protected handleError(
    c: Context<AppContext>,
    error: unknown,
    operation: string,
    defaultCode = "OPERATION_FAILED",
    defaultMessage?: string,
    statusCode = 500
  ): Response {
    // 对于 Error 对象，使用其 message；对于非 Error 对象，如果没有提供 defaultMessage 则使用 String(error)，否则使用 defaultMessage
    let errorMessage: string;
    if (error instanceof Error) {
      errorMessage = error.message;
    } else {
      errorMessage = defaultMessage ?? String(error);
    }

    const errorCode =
      error instanceof Error && "code" in error
        ? String((error as { code: unknown }).code)
        : defaultCode;

    c.get("logger").error(`${operation}失败:`, error);

    return c.fail(
      errorCode,
      errorMessage || "操作失败",
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
    c: Context<AppContext>,
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
