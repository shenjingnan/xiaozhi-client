/**
 * 超时处理相关类型定义
 */

/**
 * 超时错误类型
 */
export class TimeoutError extends Error {
  public override readonly name = "TimeoutError" as const;

  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
    Error.captureStackTrace(this, TimeoutError);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      stack: this.stack,
    };
  }
}

/**
 * 超时响应接口
 */
export interface TimeoutResponse {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError: boolean;
  taskId: string;
  status: "timeout";
  message: string;
  nextAction: string;
}

/**
 * 验证是否为超时响应
 */
export function isTimeoutResponse(
  response: unknown
): response is TimeoutResponse {
  return !!(
    response &&
    typeof response === "object" &&
    "status" in response &&
    response.status === "timeout" &&
    "taskId" in response &&
    typeof response.taskId === "string" &&
    "content" in response &&
    Array.isArray(response.content) &&
    response.content.length > 0 &&
    response.content[0].type === "text"
  );
}

/**
 * 验证是否为超时错误
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return !!(
    error &&
    typeof error === "object" &&
    "name" in error &&
    error.name === "TimeoutError" &&
    error instanceof TimeoutError
  );
}
