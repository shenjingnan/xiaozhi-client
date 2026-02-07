/**
 * 后端类型定义统一导出模块
 *
 * 本文件作为后端类型系统的中心入口，聚合并重新导出以下模块的类型定义：
 *
 * - **MCP 相关类型** (mcp.ts)：MCP 消息、响应、错误、工具缓存配置、任务状态等
 * - **扣子 API 类型** (coze.ts)：Coze API 请求和响应类型
 * - **超时配置类型** (timeout.ts)：超时相关配置和错误类型
 * - **Hono 上下文类型** (hono.context.ts)：Hono 框架上下文扩展
 *
 * @module backend/types
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
