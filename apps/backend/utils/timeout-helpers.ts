/**
 * 超时相关辅助函数
 */

import type { TimeoutError, TimeoutResponse } from "@/types/timeout.js";

// 重新导出 TimeoutError 类以便使用
export { TimeoutError } from "@/types/timeout.js";

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
    (response as { status: string }).status === "timeout" &&
    typeof (response as { taskId: string }).taskId === "string" &&
    Array.isArray((response as { content: unknown[] }).content) &&
    (response as { content: Array<{ type: string }> }).content.length > 0 &&
    (response as { content: Array<{ type: string }> }).content[0].type === "text"
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
    (error as { name: string }).name === "TimeoutError" &&
    error instanceof Error
  );
}
