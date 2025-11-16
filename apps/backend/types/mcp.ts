/**
 * MCP 相关类型定义
 */

import { createHash } from "node:crypto";
import type { ToolCallResult } from "@services/CustomMCPHandler.js";
import type { MCPToolsCache } from "@services/MCPCacheManager.js";
import type { TimeoutResponse } from "./timeout.js";

/**
 * 扩展的 MCP 工具缓存接口
 * 增加对 CustomMCP 执行结果的支持
 */
export interface ExtendedMCPToolsCache extends MCPToolsCache {
  customMCPResults?: Record<string, EnhancedToolResultCache>; // 增强的工具执行结果缓存
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
  timeout?: number; // 超时时间（毫秒）
  retries?: number; // 重试次数
  retryDelay?: number; // 重试延迟（毫秒）
  enableCache?: boolean; // 是否启用缓存
  taskId?: string; // 任务ID
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
 * 超时配置选项
 */
export interface TimeoutConfig {
  timeout?: number; // 超时时间（毫秒），默认8秒
  enableFriendlyTimeout?: boolean; // 是否启用友好超时响应
  backgroundProcessing?: boolean; // 是否启用后台处理
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

/**
 * 验证是否为工具调用结果
 */
export function isToolCallResult(response: unknown): response is ToolCallResult {
  if (!response || typeof response !== "object") {
    return false;
  }

  if (!("content" in response) || !Array.isArray(response.content)) {
    return false;
  }

  if (response.content.length === 0) {
    return false;
  }

  const firstItem = response.content[0];
  return (
    firstItem &&
    typeof firstItem === "object" &&
    "type" in firstItem &&
    firstItem.type === "text" &&
    "text" in firstItem &&
    typeof firstItem.text === "string"
  );
}

/**
 * 验证是否为增强的工具结果缓存
 */
export function isEnhancedToolResultCache(
  cache: unknown
): cache is EnhancedToolResultCache {
  if (!cache || typeof cache !== "object") {
    return false;
  }

  if (!("timestamp" in cache) || typeof cache.timestamp !== "string") {
    return false;
  }

  if (!("ttl" in cache) || typeof cache.ttl !== "number") {
    return false;
  }

  if (!("status" in cache) || !["completed", "pending", "failed", "consumed"].includes(cache.status as string)) {
    return false;
  }

  if (!("consumed" in cache) || typeof cache.consumed !== "boolean") {
    return false;
  }

  if (!("retryCount" in cache) || typeof cache.retryCount !== "number") {
    return false;
  }

  return true;
}

/**
 * 验证是否为扩展的 MCP 工具缓存
 */
export function isExtendedMCPToolsCache(
  cache: unknown
): cache is ExtendedMCPToolsCache {
  if (!cache || typeof cache !== "object") {
    return false;
  }

  if (!("version" in cache) || typeof cache.version !== "string") {
    return false;
  }

  if (!("mcpServers" in cache) || typeof cache.mcpServers !== "object") {
    return false;
  }

  if (!("metadata" in cache) || typeof cache.metadata !== "object") {
    return false;
  }

  return true;
}

/**
 * 生成缓存键的工具函数
 */
export function generateCacheKey(toolName: string, arguments_: Record<string, unknown>): string {
  const argsHash = createHash("md5")
    .update(JSON.stringify(arguments_ || {}))
    .digest("hex");
  return `${toolName}_${argsHash}`;
}

/**
 * 格式化时间戳的工具函数
 */
export function formatTimestamp(timestamp: number | Date = Date.now()): string {
  return new Date(timestamp).toISOString();
}

/**
 * 检查缓存是否过期
 */
export function isCacheExpired(timestamp: string, ttl: number): boolean {
  const cachedTime = new Date(timestamp).getTime();
  const now = Date.now();
  return now - cachedTime > ttl;
}

/**
 * 检查是否应该清理缓存条目
 */
export function shouldCleanupCache(cache: EnhancedToolResultCache): boolean {
  const now = Date.now();
  const cachedTime = new Date(cache.timestamp).getTime();

  // 已消费且超过清理时间（1分钟）
  if (cache.consumed && now - cachedTime > 60000) {
    return true;
  }

  // 已过期
  if (now - cachedTime > cache.ttl) {
    return true;
  }

  // 失败的任务立即清理
  if (cache.status === "failed") {
    return true;
  }

  return false;
}

/**
 * 默认配置常量
 */
export const DEFAULT_CONFIG = {
  TIMEOUT: 8000, // 8秒超时
  CACHE_TTL: 300000, // 5分钟缓存
  CLEANUP_INTERVAL: 60000, // 1分钟清理间隔
  MAX_CACHE_SIZE: 1000, // 最大缓存条目数
  ENABLE_ONE_TIME_CACHE: true, // 启用一次性缓存
} as const;
