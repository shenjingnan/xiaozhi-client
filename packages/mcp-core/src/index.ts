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
  // 配置相关
  MCPServiceConfig,
  ModelScopeSSEOptions,
  UnifiedServerConfig,
  // 状态相关
  MCPServiceStatus,
  MCPServiceConnectionStatus,
  ManagerStatus,
  UnifiedServerStatus,
  // 工具相关
  ToolInfo,
  EnhancedToolInfo,
  ToolCallResult,
  ToolCallParams,
  ValidatedToolCallParams,
  ToolCallValidationOptions,
  CustomMCPTool,
  JSONSchema,
  // 传输相关
  MCPServerTransport,
  // 事件相关
  MCPServiceEventCallbacks,
} from "./types.js";

// =========================
// 枚举导出
// =========================

export {
  MCPTransportType,
  ConnectionState,
  ToolCallErrorCode,
} from "./types.js";

// =========================
// 类导出
// =========================

export { ToolCallError } from "./types.js";
export { MCPConnection } from "./connection.js";
export { MCPManager, MCPServiceManager } from "./manager.js";

// =========================
// 传输工厂导出
// =========================

export { TransportFactory } from "./transport-factory.js";

// =========================
// Logger 导出
// =========================

export { logger, getLogger, setLogger } from "./logger.js";
export type { ILogger } from "./logger.js";

// =========================
// 工具函数导出
// =========================

export {
  TypeFieldNormalizer,
  normalizeTypeField,
  validateToolCallParams,
  inferTransportTypeFromUrl,
  inferTransportTypeFromConfig,
} from "./utils/index.js";

// =========================
// 类型守卫导出
// =========================

export {
  isValidToolJSONSchema,
  ensureToolJSONSchema,
} from "./types.js";
