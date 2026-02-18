/**
 * MCP 工具相关类型定义
 */

import type { ToolCallResult } from "./cache";

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
export function isToolCallResult(response: unknown): response is ToolCallResult {
  if (!response || typeof response !== "object") {
    return false;
  }
  const obj = response as Record<string, unknown>;
  return (
    Array.isArray(obj.content) &&
    obj.content.length > 0 &&
    typeof obj.content[0] === "object" &&
    obj.content[0] !== null &&
    (obj.content[0] as Record<string, unknown>).type === "text" &&
    typeof (obj.content[0] as Record<string, unknown>).text === "string"
  );
}

/**
 * 验证是否为超时响应
 */
export function isTimeoutResponse(response: unknown): response is TimeoutResponse {
  if (!response || typeof response !== "object") {
    return false;
  }
  const obj = response as Record<string, unknown>;
  return (
    obj.isTimeout === true &&
    typeof obj.timeoutMs === "number" &&
    typeof obj.message === "string"
  );
}
