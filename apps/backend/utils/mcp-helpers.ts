/**
 * MCP 类型辅助函数
 * 提供类型检查和验证功能
 */

import { createHash } from "node:crypto";
import type { MCPToolsCache } from "@/lib/mcp";
import type {
  EnhancedToolResultCache,
  ExtendedMCPToolsCache,
  ToolCallResult,
} from "@/types/mcp.js";

/**
 * 验证是否为工具调用结果
 */
export function isToolCallResult(
  response: unknown
): response is ToolCallResult {
  return (
    !!response &&
    typeof response === "object" &&
    response !== null &&
    "content" in response &&
    Array.isArray((response as ToolCallResult).content) &&
    (response as ToolCallResult).content.length > 0 &&
    (response as ToolCallResult).content[0]?.type === "text" &&
    typeof (response as ToolCallResult).content[0]?.text === "string"
  );
}

/**
 * 验证是否为增强的工具结果缓存
 */
export function isEnhancedToolResultCache(
  cache: unknown
): cache is EnhancedToolResultCache {
  const cacheObj = cache as EnhancedToolResultCache;
  return (
    !!cache &&
    typeof cache === "object" &&
    cache !== null &&
    typeof cacheObj.timestamp === "string" &&
    typeof cacheObj.ttl === "number" &&
    typeof cacheObj.status === "string" &&
    ["completed", "pending", "failed", "consumed"].includes(cacheObj.status) &&
    typeof cacheObj.consumed === "boolean" &&
    typeof cacheObj.retryCount === "number"
  );
}

/**
 * 验证是否为扩展的 MCP 工具缓存
 */
export function isExtendedMCPToolsCache(
  cache: unknown
): cache is ExtendedMCPToolsCache {
  const cacheObj = cache as ExtendedMCPToolsCache;
  return (
    !!cache &&
    typeof cache === "object" &&
    cache !== null &&
    typeof cacheObj.version === "string" &&
    typeof cacheObj.mcpServers === "object" &&
    cacheObj.mcpServers !== null &&
    typeof cacheObj.metadata === "object" &&
    cacheObj.metadata !== null
  );
}

/**
 * 生成缓存键的工具函数
 */
export function generateCacheKey(
  toolName: string,
  arguments_: Record<string, unknown>
): string {
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
  if (cache.consumed && now - cachedTime > 60_000) {
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
