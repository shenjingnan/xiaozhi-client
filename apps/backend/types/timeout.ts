/**
 * 超时错误类型
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    // 使用 Object.defineProperty 设置不可枚举的 name 属性
    Object.defineProperty(this, "name", {
      value: "TimeoutError",
      enumerable: false,
      configurable: true,
      writable: false,
    });
    Error.captureStackTrace(this, TimeoutError);
  }

  /**
   * 覆盖 Error.prototype.toJSON
   */
  toJSON(): { name: string; message: string; stack?: string } {
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
  /** 支持其他未知字段，与 ToolCallResult 保持兼容 */
  [key: string]: unknown;
}
