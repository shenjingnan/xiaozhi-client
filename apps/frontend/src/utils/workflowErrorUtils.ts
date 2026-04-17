/**
 * 工作流错误处理工具函数
 *
 * 提供工作流操作相关的错误信息提取和格式化功能
 *
 * @module workflowErrorUtils
 */

/**
 * 根据错误类型生成用户友好的错误信息
 *
 * @param error - 捕获的错误对象
 * @param workflowName - 工作流名称，用于个性化错误信息
 * @returns 格式化后的用户友好错误信息
 *
 * @example
 * ```typescript
 * try {
 *   await addWorkflow(workflow);
 * } catch (error) {
 *   toast.error(extractWorkflowErrorMessage(error, workflow.workflow_name));
 * }
 * ```
 */
export function extractWorkflowErrorMessage(
  error: unknown,
  workflowName: string
): string {
  const defaultMessage = "添加工作流失败，请重试";

  if (error instanceof Error) {
    if (error.message.includes("已存在") || error.message.includes("冲突")) {
      return `工作流 "${workflowName}" 已存在，请勿重复添加`;
    }
    if (error.message.includes("配置") || error.message.includes("token")) {
      return "系统配置错误，请检查扣子API配置";
    }
    if (error.message.includes("验证失败") || error.message.includes("格式")) {
      return "工作流数据格式错误，请联系管理员";
    }
    if (
      error.message.includes("网络") ||
      error.message.includes("超时") ||
      error.message.includes("连接")
    ) {
      return "网络连接失败，请检查网络后重试";
    }
    if (error.message.includes("权限")) {
      return "权限不足，请检查API权限配置";
    }
    if (error.message.includes("频繁")) {
      return "操作过于频繁，请稍后重试";
    }
    return error.message;
  }

  return defaultMessage;
}
