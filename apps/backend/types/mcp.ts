/**
 * MCP 相关类型定义
 */

import type { MCPToolsCache } from "@/lib/mcp";
import type { TimeoutResponse } from "./timeout.js";

/**
 * 工具调用结果接口（与 MCPServiceManager 保持一致）
 */
export interface ToolCallResult {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
  [key: string]: unknown; // 支持其他未知字段，与 lib/mcp/types 保持兼容
}

/**
 * MCP 消息接口 - 定义 JSON-RPC 2.0 标准消息格式
 */
export interface MCPMessage {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
  id: string | number;
}

/**
 * MCP 响应接口 - 定义 JSON-RPC 2.0 标准响应格式
 */
export interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: MCPError;
}

/**
 * MCP 错误接口 - 定义 JSON-RPC 2.0 标准错误格式
 */
export interface MCPError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * 扩展的 MCP 工具缓存接口
 * 增加对 CustomMCP 执行结果的支持
 */
export interface ExtendedMCPToolsCache extends MCPToolsCache {
  /** 增强的工具执行结果缓存 */
  customMCPResults?: Record<string, EnhancedToolResultCache>;
}

/**
 * 增强的工具执行结果缓存
 * 用于存储 CustomMCP 工具的执行结果和状态
 */
export interface EnhancedToolResultCache {
  /** 工具执行结果 */
  result: ToolCallResult;
  /** ISO 8601 格式时间戳 */
  timestamp: string;
  /** 过期时间（毫秒） */
  ttl: number;
  /** 任务状态 */
  status: TaskStatus;
  /** 是否已被消费（一次性缓存机制） */
  consumed: boolean;
  /** 任务ID，用于查询 */
  taskId?: string;
  /** 重试次数 */
  retryCount: number;
}

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
 * 工具调用选项
 */
export interface ToolCallOptions {
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 重试次数 */
  retries?: number;
  /** 重试延迟（毫秒） */
  retryDelay?: number;
  /** 是否启用缓存 */
  enableCache?: boolean;
  /** 任务ID */
  taskId?: string;
}

/**
 * 缓存配置选项
 */
export interface CacheConfig {
  /** 缓存过期时间（毫秒），默认5分钟 */
  ttl?: number;
  /** 清理间隔（毫秒），默认1分钟 */
  cleanupInterval?: number;
  /** 最大缓存条目数 */
  maxCacheSize?: number;
  /** 是否启用一次性缓存 */
  enableOneTimeCache?: boolean;
}

/**
 * 超时配置选项
 */
export interface TimeoutConfig {
  /** 超时时间（毫秒），默认8秒 */
  timeout?: number;
  /** 是否启用友好超时响应 */
  enableFriendlyTimeout?: boolean;
  /** 是否启用后台处理 */
  backgroundProcessing?: boolean;
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
 * 缓存统计信息
 */
export interface CacheStatistics {
  totalEntries: number;
  pendingTasks: number;
  completedTasks: number;
  failedTasks: number;
  consumedEntries: number;
  cacheHitRate: number;
  lastCleanupTime: string;
  memoryUsage: number;
}

/**
 * 工具调用结果联合类型
 * 包含正常结果和超时响应
 */
export type ToolCallResponse = ToolCallResult | TimeoutResponse;
