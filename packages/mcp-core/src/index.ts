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
export { MCPServiceManager } from "./manager.js";

// =========================
// 工具函数导出
// =========================

export { isValidToolJSONSchema, ensureToolJSONSchema } from "./types.js";
