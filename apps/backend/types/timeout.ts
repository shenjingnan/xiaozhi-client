/**
 * 超时错误类型
 * 从 @xiaozhi-client/shared-types 重新导出共享类型
 */

// 从 shared-types 导入共享类型（用于本文件）
import {
  TimeoutError,
  type TimeoutResponse,
  isTimeoutError,
  isTimeoutResponse,
} from "packages/shared-types/src/utils/timeout";

// 重新导出以供外部使用
export { TimeoutError, isTimeoutError, isTimeoutResponse };
export type { TimeoutResponse };

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
