/**
 * MCP 任务相关类型定义
 */

import type { ToolCallResult } from "./cache";

/**
 * 任务状态类型
 */
export type TaskStatus =
  | "pending"
  | "completed"
  | "failed"
  | "consumed"
  | "deleted";

/**
 * 缓存状态转换接口
 */
export interface CacheStateTransition {
  from: TaskStatus;
  to: TaskStatus;
  reason: string;
  timestamp: string;
}

/**
 * 任务信息接口
 */
export interface TaskInfo {
  taskId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  status: TaskStatus;
  startTime: string;
  endTime?: string;
  error?: string;
  result?: ToolCallResult;
}

/**
 * 超时配置选项
 */
export interface TimeoutConfig {
  timeout?: number; // 超时时间（毫秒），默认8秒
  enableFriendlyTimeout?: boolean; // 是否启用友好超时响应
  backgroundProcessing?: boolean; // 是否启用后台处理
}
