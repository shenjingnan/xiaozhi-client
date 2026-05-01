/**
 * 超时处理相关类型定义（服务器扩展版本）
 *
 * 此文件从 ../../types/utils/timeout 导入基础类型，
 * 并添加服务器特有的功能函数和扩展类型。
 *
 * @see ../../types/utils/timeout - 基础超时类型定义
 */

// 从基础模块导入 TimeoutError 类
export { TimeoutError } from "../../types/utils/timeout.js";

// 导入基础 TimeoutResponse 类型用于扩展
import type { TimeoutResponse as BaseTimeoutResponse } from "../../types/utils/timeout.js";

/**
 * 超时响应接口（服务器扩展版本）
 * 扩展基础类型，添加索引签名以支持与其他类型的兼容性
 */
export interface TimeoutResponse extends BaseTimeoutResponse {
  /** 支持其他未知字段，与 ToolCallResult 保持兼容 */
  [key: string]: unknown;
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
  if (
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
  ) {
    return true;
  }
  return false;
}

/**
 * 验证是否为超时错误
 * 从基础模块重新导出
 */
export { isTimeoutError } from "../../types/utils/timeout.js";
