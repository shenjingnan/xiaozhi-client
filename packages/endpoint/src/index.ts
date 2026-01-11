/**
 * @xiaozhi-client/endpoint
 *
 * 小智接入点 WebSocket 连接管理库
 *
 * 此库提供了连接小智接入点的完整功能，包括：
 * - EndpointConnection: 单个接入点的 WebSocket 连接管理
 * - EndpointManager: 多个接入点的连接管理
 *
 * @example
 * ```typescript
 * import { EndpointConnection } from '@xiaozhi-client/endpoint';
 *
 * const connection = new EndpointConnection('ws://xiaozhi.example.com/endpoint');
 * connection.setServiceManager(serviceManager);
 * await connection.connect();
 * ```
 */

// =========================
// 核心类导出
// =========================

export { EndpointConnection } from "./connection.js";
export { EndpointManager } from "./manager.js";

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
  ConfigChangeEvent,
  ReconnectResult,
  // JSON Schema
  JSONSchema,
} from "./types.js";

// =========================
// 枚举导出
// =========================

export { ToolCallErrorCode, ConnectionState } from "./types.js";

// =========================
// 错误类导出
// =========================

export { ToolCallError } from "./types.js";

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
} from "./utils.js";

export { ensureToolJSONSchema } from "./types.js";

// =========================
// MCP 类型导出
// =========================

export type { MCPMessage, ExtendedMCPMessage } from "./mcp.js";
