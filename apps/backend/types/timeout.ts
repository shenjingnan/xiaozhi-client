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
  [key: string]: unknown; // 支持其他未知字段，与 ToolCallResult 保持兼容
}

/**
 * 创建超时响应的工具函数
 */
export function createTimeoutResponse(
  taskId: string,
  toolName?: string
): TimeoutResponse {
  const toolSpecificMessage = toolName
    ? getToolSpecificTimeoutMessage(toolName, taskId)
    : getDefaultTimeoutMessage(taskId);

  return {
    content: [
      {
        type: "text",
        text: toolSpecificMessage,
      },
    ],
    isError: false,
    taskId,
    status: "timeout",
    message: "工具调用超时，正在后台处理中",
    nextAction: "请稍后重试或等待任务完成",
  };
}

/**
 * 获取工具特定的超时提示信息
 */
function getToolSpecificTimeoutMessage(
  toolName: string,
  taskId: string
): string {
  const toolMessages: Record<string, string> = {
    coze_workflow: `⏱️ 扣子工作流执行超时，正在后台处理中...
    
📋 任务信息：
- 任务ID: ${taskId}
- 工具类型: 扣子工作流
- 状态: 处理中
- 建议: 请等待30-60秒后重试查询

🔄 后续操作：
1. 使用相同参数重新调用工具
2. 系统会自动返回已完成的任务结果
3. 复杂工作流可能需要更长时间处理`,

    default: getDefaultTimeoutMessage(taskId),
  };

  return toolMessages[toolName] || toolMessages.default;
}

/**
 * 获取默认超时提示信息
 */
function getDefaultTimeoutMessage(taskId: string): string {
  return `⏱️ 工具调用超时，正在后台处理中...
    
📋 任务信息：
- 任务ID: ${taskId}
- 状态: 处理中
- 建议: 请等待30秒后重试查询

🔄 后续操作：
1. 使用相同的参数重新调用工具
2. 系统会自动返回已完成的任务结果
3. 如果长时间未完成，请联系管理员`;
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
    response !== null &&
    "status" in response &&
    response.status === "timeout" &&
    "taskId" in response &&
    typeof response.taskId === "string" &&
    "content" in response &&
    Array.isArray(response.content) &&
    response.content.length > 0 &&
    typeof response.content[0] === "object" &&
    response.content[0] !== null &&
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
    error !== null &&
    "name" in error &&
    error.name === "TimeoutError" &&
    error instanceof TimeoutError
  );
}
