/**
 * MCP 核心库类型定义
 * 统一管理所有 MCP 相关的类型定义
 *
 * 注意：大部分类型从 @xiaozhi-client/mcp-core 重新导出
 * 仅保留 backend 特有的类型定义
 */

// =========================
// 从 mcp-core 重新导出的类型
// =========================

export type {
  // 配置相关
  MCPServiceConfig,
  ModelScopeSSEOptions,
  UnifiedServerConfig,
  InternalMCPServiceConfig,
  LegacyMCPServiceConfig,
  // 状态相关
  MCPServiceStatus,
  MCPServiceConnectionStatus,
  ManagerStatus,
  UnifiedServerStatus,
  // 工具相关
  ToolInfo,
  EnhancedToolInfo,
  ToolCallParams,
  ValidatedToolCallParams,
  ToolCallValidationOptions,
  CustomMCPTool,
  JSONSchema,
  ToolStatusFilter,
  // 传输相关
  MCPServerTransport,
  // 事件相关
  MCPServiceEventCallbacks,
} from "@xiaozhi-client/mcp-core";

// =========================
// 从 mcp-core 重新导出的枚举
// =========================

export {
  MCPTransportType,
  ConnectionState,
  ToolCallErrorCode,
} from "@xiaozhi-client/mcp-core";

// =========================
// 从 mcp-core 重新导出的类
// =========================

export { ToolCallError } from "@xiaozhi-client/mcp-core";

// =========================
// 从 mcp-core 重新导出的类型守卫
// =========================

export {
  isValidToolJSONSchema,
  ensureToolJSONSchema,
} from "@xiaozhi-client/mcp-core";

// =========================
// Backend 特有类型定义
// =========================

/**
 * 工具调用结果接口
 * 使用简化的类型定义，保持向后兼容性
 * 注意：这与 @xiaozhi-client/mcp-core 中的 ToolCallResult 类型不同
 * mcp-core 使用 SDK 的 CompatibilityCallToolResult，此版本支持额外的未知字段
 */
export interface ToolCallResult {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
  [key: string]: unknown; // 支持其他未知字段，与 endpoint 包保持兼容
}

// =========================
// 向后兼容性别名
// =========================

/**
 * 向后兼容：ServiceStatus 别名
 * 为了与现有代码保持兼容，暂时保留此别名
 * @deprecated 请使用 MCPServiceConnectionStatus
 */
export type ServiceStatus = import("@xiaozhi-client/mcp-core").MCPServiceConnectionStatus;