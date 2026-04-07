/**
 * @xiaozhi-client/endpoint
 *
 * 小智接入点 WebSocket 连接管理库
 *
 * 此库提供了连接小智接入点的完整功能，包括：
 * - Endpoint: 单个接入点的连接管理
 * - EndpointManager: 多个接入点的连接管理，共享外部传入的 MCP 服务
 * - SharedMCPAdapter: 共享 MCP 管理器适配器
 *
 * @example
 * ```typescript
 * // 新的使用方式（推荐）
 * import { EndpointManager } from '@xiaozhi-client/endpoint';
 * import { MCPManager } from '@xiaozhi-client/mcp-core';
 *
 * // 1. 先创建并配置 MCPManager
 * const mcpManager = new MCPManager();
 * mcpManager.addServer("calculator", {
 *   command: "npx",
 *   args: ["-y", "@xiaozhi-client/calculator-mcp@1.9.7-beta.16"]
 * });
 * mcpManager.addServer("datetime", {
 *   command: "npx",
 *   args: ["-y", "@xiaozhi-client/datetime-mcp@1.9.7-beta.16"]
 * });
 * await mcpManager.connect();
 *
 * // 2. 创建 EndpointManager 并设置 MCPManager
 * const endpointManager = new EndpointManager();
 * endpointManager.setMcpManager(mcpManager);
 *
 * // 3. 添加接入点（共享 MCP 服务）
 * endpointManager.addEndpoint("wss://api.xiaozhi.me/mcp/?token=...");
 * await endpointManager.connect();
 * ```
 */

// =========================
// 导出
// =========================

export { Endpoint } from "./endpoint.js";
export { EndpointManager } from "./manager.js";
export { SharedMCPAdapter } from "./shared-mcp-adapter.js";
export { createLogger, LogLevel } from "./logger.js";

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
  // JWT Token 相关
  XiaozhiTokenPayload,
  ParsedEndpointInfo,
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
  // JWT Token 解码相关
  decodeJWTToken,
  extractTokenFromUrl,
  parseEndpointUrl,
} from "./utils.js";

export { ensureToolJSONSchema } from "./types.js";

// =========================
// MCP 类型导出
// =========================

export type { MCPMessage, ExtendedMCPMessage } from "./mcp.js";
