/**
 * @xiaozhi-client/mcp-core
 *
 * MCP 协议核心实现库
 * 提供 MCP 服务管理、连接和工具调用的核心功能
 */

// =========================
// 类型导出
// =========================

export type {
  CustomMCPTool,
  EnhancedToolInfo,
  JSONSchema,
  ManagerStatus,
  // 传输相关
  MCPServerTransport,
  // 配置相关
  MCPServiceConfig,
  MCPServiceConnectionStatus,
  // 事件相关
  MCPServiceEventCallbacks,
  // 状态相关
  MCPServiceStatus,
  ModelScopeSSEOptions,
  ToolCallParams,
  ToolCallResult,
  ToolCallValidationOptions,
  // 工具相关
  ToolInfo,
  UnifiedServerConfig,
  UnifiedServerStatus,
  ValidatedToolCallParams,
} from "./types.js";

// =========================
// 枚举导出
// =========================

export {
  ConnectionState,
  MCPTransportType,
  ToolCallErrorCode,
} from "./types.js";

// =========================
// 类导出
// =========================

export { MCPConnection } from "./connection.js";
export { MCPManager, MCPServiceManager } from "./manager.js";
export { ToolCallError } from "./types.js";

// =========================
// 传输工厂导出
// =========================

export { TransportFactory } from "./transport-factory.js";

// =========================
// 工具函数导出
// =========================

export {
  inferTransportTypeFromConfig,
  inferTransportTypeFromUrl,
  normalizeTypeField,
  TypeFieldNormalizer,
  validateToolCallParams,
} from "./utils/index.js";

// =========================
// 类型守卫导出
// =========================

export {
  ensureToolJSONSchema,
  isValidToolJSONSchema,
} from "./types.js";
