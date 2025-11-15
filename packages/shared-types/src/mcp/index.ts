/**
 * MCP 相关类型导出
 */

// 缓存相关类型
export type {
  ToolCallResult,
  ExtendedMCPToolsCache,
  EnhancedToolResultCache,
  CacheConfig,
  CacheStatistics,
  ToolCallOptions,
} from "./cache";

// 任务相关类型
export type {
  TaskStatus,
  CacheStateTransition,
  TaskInfo,
  TimeoutConfig,
} from "./task";

// 消息协议相关类型
export type {
  MCPMessage,
  MCPResponse,
  MCPError,
  TransportConfig,
} from "./message";

export { ConnectionState } from "./message";

// 工具相关类型
export type {
  ToolCallResponse,
  TimeoutResponse,
} from "./tools";

export {
  isToolCallResult,
  isTimeoutResponse,
} from "./tools";

// 传输层相关类型
export type {
  ExtendedTransportConfig,
  ConnectionStats,
} from "./transport";
