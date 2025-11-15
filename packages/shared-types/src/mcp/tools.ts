/**
 * MCP 工具相关类型定义
 */

import type { ToolCallResult } from './cache'

/**
 * 工具调用结果联合类型
 * 包含正常结果和超时响应
 */
export type ToolCallResponse = ToolCallResult | TimeoutResponse;

/**
 * 超时响应接口
 */
export interface TimeoutResponse {
  /** 是否为超时响应 */
  isTimeout: true;
  /** 超时时间（毫秒） */
  timeoutMs: number;
  /** 友好的超时消息 */
  message: string;
  /** 任务ID */
  taskId?: string;
  /** 是否在后台处理 */
  backgroundProcessing: boolean;
}

/**
 * 验证是否为工具调用结果
 */
export function isToolCallResult(response: any): response is ToolCallResult {
  return (
    response &&
    Array.isArray(response.content) &&
    response.content.length > 0 &&
    response.content[0].type === "text" &&
    typeof response.content[0].text === "string"
  );
}

/**
 * 验证是否为超时响应
 */
export function isTimeoutResponse(response: any): response is TimeoutResponse {
  return (
    response &&
    typeof response === "object" &&
    response.isTimeout === true &&
    typeof response.timeoutMs === "number" &&
    typeof response.message === "string"
  );
}