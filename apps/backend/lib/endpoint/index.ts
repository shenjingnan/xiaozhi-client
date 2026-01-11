/**
 * 小智接入点连接管理模块
 *
 * 此模块重新导出 @xiaozhi-client/endpoint 包
 */

// =========================
// 从独立包重新导出
// =========================

// 核心类导出（新 API）
export {
  Endpoint,
  EndpointManager,
  ToolCallErrorCode,
  ToolCallError,
} from "@xiaozhi-client/endpoint";

// =========================
// 类型导出
// =========================

export type {
  // 工具调用相关
  ToolCallResult,
  ToolCallParams,
  ValidatedToolCallParams,
  // 服务管理器接口
  IMCPServiceManager,
  // 连接状态相关
  EndpointConnectionStatus,
  ConnectionOptions,
  // 管理器状态相关
  SimpleConnectionStatus,
  ConnectionStatus,
  ConfigChangeEvent as EndpointConfigChangeEvent,
  ReconnectResult,
  // JSON Schema
  JSONSchema,
  // 新 API 配置类型
  MCPServerConfig,
  LocalMCPServerConfig,
  SSEMCPServerConfig,
  StreamableHTTPMCPServerConfig,
  EndpointConfig,
  EndpointManagerConfig,
} from "@xiaozhi-client/endpoint";

// =========================
// 枚举导出
// =========================

export { ConnectionState } from "@xiaozhi-client/endpoint";

// =========================
// 工具函数导出
// =========================

export {
  sliceEndpoint,
  validateToolCallParams,
  isValidEndpointUrl,
  deepMerge,
  sleep,
  formatErrorMessage,
} from "@xiaozhi-client/endpoint";

export { ensureToolJSONSchema } from "@xiaozhi-client/endpoint";

// =========================
// MCP 类型导出
// =========================

export type { MCPMessage, ExtendedMCPMessage } from "@xiaozhi-client/endpoint";
