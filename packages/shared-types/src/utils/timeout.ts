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
export function isTimeoutResponse(response: any): response is TimeoutResponse {
  return !!(
    response &&
    response.status === "timeout" &&
    typeof response.taskId === "string" &&
    Array.isArray(response.content) &&
    response.content.length > 0 &&
    response.content[0].type === "text"
  );
}

/**
 * 验证是否为超时错误
 */
export function isTimeoutError(error: any): error is TimeoutError {
  return !!(
    error &&
    error.name === "TimeoutError" &&
    error instanceof TimeoutError
  );
}
