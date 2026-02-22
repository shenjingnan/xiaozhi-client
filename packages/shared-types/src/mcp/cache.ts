/**
 * MCP 缓存相关类型定义
 */

import type { TaskStatus } from "./task";

/**
 * 工具调用结果接口
 * 支持其他未知字段，与其他包保持兼容
 */
export interface ToolCallResult {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
  [key: string]: unknown; // 支持其他未知字段，保持兼容性
}

/**
 * 扩展的 MCP 工具缓存接口
 * 增加对 CustomMCP 执行结果的支持
 */
export interface ExtendedMCPToolsCache {
  customMCPResults?: Record<string, EnhancedToolResultCache>;
}

/**
 * 增强的工具执行结果缓存
 * 用于存储 CustomMCP 工具的执行结果和状态
 */
export interface EnhancedToolResultCache {
  result: ToolCallResult;
  timestamp: string; // ISO 8601 格式时间戳
  ttl: number; // 过期时间（毫秒）
  status: TaskStatus; // 任务状态
  consumed: boolean; // 是否已被消费（一次性缓存机制）
  taskId?: string; // 任务ID，用于查询
  retryCount: number; // 重试次数
}

/**
 * 缓存配置选项
 */
export interface CacheConfig {
  ttl?: number; // 缓存过期时间（毫秒），默认5分钟
  cleanupInterval?: number; // 清理间隔（毫秒），默认1分钟
  maxCacheSize?: number; // 最大缓存条目数
  enableOneTimeCache?: boolean; // 是否启用一次性缓存
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
 * 工具调用选项
 */
export interface ToolCallOptions {
  timeout?: number; // 超时时间（毫秒）
  retries?: number; // 重试次数
  retryDelay?: number; // 重试延迟（毫秒）
  enableCache?: boolean; // 是否启用缓存
  taskId?: string; // 任务ID
}
