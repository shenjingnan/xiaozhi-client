import type { AppContext } from "@/types/hono.context.js";
import type { Context } from "hono";

/**
 * 抽象 API Handler 基类
 * 提供便捷的辅助方法
 * logger 通过 c.get("logger") 访问（Hono 推荐做法）
 */
export abstract class BaseHandler {
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
    c: Context<AppContext>,
    error: unknown,
    operation: string,
    defaultCode = "OPERATION_FAILED",
    defaultMessage = "操作失败",
    statusCode = 500
  ): Response {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode =
      error instanceof Error && "code" in error
        ? String((error as { code: unknown }).code)
        : defaultCode;

    c.get("logger").error(`${operation}失败:`, error);

    return c.fail(
      errorCode,
      errorMessage || defaultMessage,
      undefined,
      statusCode
    );
  }

  /**
   * 新增：记录错误日志并返回失败响应
   * @param c - Hono context
   * @param error - 错误对象
   * @param operation - 操作描述（用于日志）
   * @param errorCode - 错误码
   * @param errorMessage - 错误消息（可选，默认使用 error.message）
   * @param statusCode - HTTP 状态码（默认 500）
   * @returns JSON 错误响应
   */
  protected logAndFail(
    c: Context<AppContext>,
    error: unknown,
    operation: string,
    errorCode = "OPERATION_FAILED",
    errorMessage?: string,
    statusCode = 500
  ): Response {
    c.get("logger").error(`${operation}失败:`, error);
    return c.fail(
      errorCode,
      errorMessage || this.getErrorMessage(error),
      undefined,
      statusCode
    );
  }

  /**
   * 新增：验证必需参数
   * @param c - Hono context
   * @param params - 参数对象
   * @param requiredFields - 必需字段列表
   * @returns 如果验证失败返回 Response，否则返回 null
   */
  protected validateRequired(
    c: Context<AppContext>,
    params: Record<string, unknown>,
    requiredFields: string[]
  ): Response | null {
    const missing = requiredFields.filter((field) => !params[field]);
    if (missing.length > 0) {
      return c.fail(
        "INVALID_REQUEST",
        `缺少必需参数: ${missing.join(", ")}`,
        undefined,
        400
      );
    }
    return null;
  }

  /**
   * 新增：获取错误消息
   * @param error - 错误对象
   * @returns 错误消息字符串
   */
  protected getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
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
