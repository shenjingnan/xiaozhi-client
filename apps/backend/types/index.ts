/**
 * 后端类型定义统一导出模块
 *
 * 此文件作为 apps/backend/types 的入口点，统一导出所有类型定义、工具函数和常量。
 * 主要包括：
 *
 * - **MCP 核心类型**：
 *   - {@link MCPMessage} - MCP 消息类型
 *   - {@link MCPResponse} - MCP 响应类型
 *   - {@link MCPError} - MCP 错误类型
 *   - {@link ExtendedMCPToolsCache} - 扩展 MCP 工具缓存类型
 *   - {@link EnhancedToolResultCache} - 增强工具结果缓存类型
 *
 * - **工具调用相关类型**：
 *   - {@link ToolCallOptions} - 工具调用选项
 *   - {@link ToolCallResponse} - 工具调用响应
 *   - {@link ToolCallResult} - 工具调用结果
 *
 * - **缓存和状态类型**：
 *   - {@link CacheStatistics} - 缓存统计信息
 *   - {@link CacheStateTransition} - 缓存状态转换
 *   - {@link CacheConfig} - 缓存配置
 *   - {@link TimeoutConfig} - 超时配置
 *
 * - **任务相关类型**：
 *   - {@link TaskStatus} - 任务状态
 *   - {@link TaskInfo} - 任务信息
 *
 * - **工具函数**：
 *   - {@link generateCacheKey} - 生成缓存键
 *   - {@link formatTimestamp} - 格式化时间戳
 *   - {@link isCacheExpired} - 检查缓存是否过期
 *
 * @example
 * ```typescript
 * // 导入类型
 * import type { MCPMessage, ToolCallOptions } from '@/types';
 *
 * // 导入工具函数
 * import { generateCacheKey, formatTimestamp } from '@/types';
 *
 * // 导入默认配置
 * import { DEFAULT_CONFIG } from '@/types';
 * ```
 *
 * @module apps/backend/types
 */
export type {
  MCPMessage,
  MCPResponse,
  MCPError,
  ExtendedMCPToolsCache,
  EnhancedToolResultCache,
  TaskStatus,
  CacheStatistics,
  CacheStateTransition,
  ToolCallOptions,
  CacheConfig,
  TimeoutConfig,
  TaskInfo,
  ToolCallResponse,
  ToolCallResult,
} from "./mcp.js";
export {
  generateCacheKey,
  formatTimestamp,
  isCacheExpired,
  shouldCleanupCache,
  isToolCallResult,
  isEnhancedToolResultCache,
  isExtendedMCPToolsCache,
  DEFAULT_CONFIG,
} from "./mcp.js";
export * from "./coze.js";
export * from "./timeout.js";
export * from "./hono.context.js";
