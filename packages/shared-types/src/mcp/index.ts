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

export { ConnectionState } from "./tool-call";

// 工具调用相关类型
export type {
  ToolCallParams,
  ValidatedToolCallParams,
  ToolJSONSchema,
  EnhancedToolInfo,
} from "./tool-call";

export {
  ToolCallErrorCode,
  ToolCallError,
  ensureToolJSONSchema,
} from "./tool-call";

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

// 工具定义类型
export type {
  CustomMCPTool,
  CustomMCPToolWithStats,
  CustomMCPToolConfig,
  ToolHandlerConfig,
  MCPHandlerConfig,
  ProxyHandlerConfig,
  HttpHandlerConfig,
  FunctionHandlerConfig,
} from "./tool-definition";

// JSON Schema 类型
export type { JSONSchema } from "./schema";

export { isJSONSchema } from "./schema";
