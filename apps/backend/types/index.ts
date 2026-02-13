/**
 * 后端类型与运行时工具统一导出模块
 *
 * 本文件作为后端类型系统及部分运行时工具函数/常量的中心入口，聚合并重新导出以下模块的内容：
 *
 * - **MCP 模块** (mcp.ts)：MCP 消息、响应、错误、工具缓存配置、任务状态等类型定义，
 *   以及与工具调用缓存相关的运行时工具函数和默认配置（例如缓存 key 生成、默认配置常量等）
 * - **扣子 API 模块** (coze.ts)：Coze API 请求和响应等类型定义（以及相关辅助类型）
 * - **超时配置模块** (timeout.ts)：超时相关配置、错误类型及其配套类型定义
 * - **Hono 上下文扩展模块** (hono.context.ts)：Hono 框架上下文扩展的类型定义，以及相关的运行时入口和辅助方法
 *
 * 注意：本文件中使用的 `.js` 后缀为编译产物路径，对应源码文件为同名的 `.ts` 文件（例如：`mcp.ts` -> `mcp.js`）。
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
