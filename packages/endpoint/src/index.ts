/**
 * @xiaozhi-client/endpoint
 *
 * 小智接入点 WebSocket 连接管理库
 *
 * 此库提供了连接小智接入点的完整功能，包括：
 * - Endpoint: 单个接入点的连接管理，配置更简洁
 * - EndpointManager: 多个接入点的连接管理
 *
 * @example
 * ```typescript
 * // 单个连接
 * import { Endpoint } from '@xiaozhi-client/endpoint';
 *
 * const endpoint = new Endpoint("ws://localhost:8080", {
 *   mcpServers: {
 *     calculator: { command: "node", args: ["./server.js"] }
 *   }
 * });
 * await endpoint.connect();
 *
 * // 多连接管理
 * import { Endpoint, EndpointManager } from '@xiaozhi-client/endpoint';
 *
 * const endpoint1 = new Endpoint("ws://localhost:8080", { mcpServers: { ... } });
 * const endpoint2 = new Endpoint("ws://localhost:8081", { mcpServers: { ... } });
 *
 * const manager = new EndpointManager();
 * manager.addEndpoint(endpoint1);
 * manager.addEndpoint(endpoint2);
 * await manager.connect();
 * ```
 */

// =========================
// 导出
// =========================

export { Endpoint } from "./endpoint.js";
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
  // 新 API 配置类型
  MCPServerConfig,
  LocalMCPServerConfig,
  SSEMCPServerConfig,
  StreamableHTTPMCPServerConfig,
  EndpointConfig,
  EndpointManagerConfig,
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
