/**
 * 超时处理相关共享类型定义
 *
 * 本模块提供超时处理的核心类型，供多个包共享使用：
 * - TimeoutError: 超时错误类型
 * - TimeoutResponse: 超时响应接口
 * - isTimeoutResponse: 类型守卫函数
 * - isTimeoutError: 类型守卫函数
 *
 * backend 特有的功能（如 createTimeoutResponse）应在 apps/backend/types/timeout.ts 中定义
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
 * 支持其他未知字段，与 ToolCallResult 保持兼容
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
  [key: string]: unknown;
}

/**
 * 验证是否为超时响应
 */
export function isTimeoutResponse(response: unknown): response is TimeoutResponse {
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
    "type" in response.content[0] &&
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