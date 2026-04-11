/**
 * MCP 核心库类型定义
 *
 * 从 @xiaozhi-client/mcp-core 重新导出类型定义
 * 保持向后兼容性，统一导入路径
 *
 * 注意：部分类型在 backend 中有自定义定义，这些类型保留在本地
 */

// =========================
// 从 mcp-core 导入类型（用于本地定义和重新导出）
// =========================

import type {
  CustomMCPTool,
  EnhancedToolInfo,
  HeartbeatConfig,
  InternalMCPServiceConfig,
  JSONSchema,
  LegacyMCPServiceConfig,
  // 传输相关
  MCPServerTransport,
  // 配置相关
  MCPServiceConfig,
  MCPServiceConnectionStatus,
  // 事件相关
  MCPServiceEventCallbacks,
  // 状态相关
  MCPServiceStatus,
  MCPTransportTypeInput,
  MCPTransportTypeString,
  ManagerStatus,
  ModelScopeSSEOptions,
  ToolCallParams,
  ToolCallValidationOptions,
  // 工具相关
  ToolInfo,
  ToolStatusFilter,
  UnifiedServerConfig,
  ValidatedToolCallParams,
} from "@xiaozhi-client/mcp-core";

import {
  ConnectionState,
  MCPTransportType,
  ToolCallError,
  ToolCallErrorCode,
  ensureToolJSONSchema,
  isValidToolJSONSchema,
} from "@xiaozhi-client/mcp-core";

// =========================
// 类型重新导出
// =========================

export type {
  // 配置相关
  MCPServiceConfig,
  ModelScopeSSEOptions,
  UnifiedServerConfig,
  InternalMCPServiceConfig,
  LegacyMCPServiceConfig,
  HeartbeatConfig,
  MCPTransportTypeInput,
  MCPTransportTypeString,
  // 状态相关
  MCPServiceStatus,
  MCPServiceConnectionStatus,
  ManagerStatus,
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
};

// =========================
// 枚举导出
// =========================

export { MCPTransportType, ConnectionState, ToolCallErrorCode };

// =========================
// 类导出
// =========================

export { ToolCallError };

// =========================
// 类型守卫导出
// =========================

export { isValidToolJSONSchema, ensureToolJSONSchema };

// =========================
// Backend 本地定义的类型
// =========================

/**
 * 工具调用结果接口
 * 使用简化的类型定义，保持向后兼容性
 * 注意：这与 @xiaozhi-client/mcp-core 中的 ToolCallResult 类型不同
 */
export interface ToolCallResult {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
  [key: string]: unknown; // 支持其他未知字段，与 endpoint 包保持兼容
}

/**
 * 统一服务器状态接口
 * 从 UnifiedMCPServer 移入，用于统一服务器状态管理
 * 注意：此版本不包含 transportCount 属性
 */
export interface UnifiedServerStatus {
  isRunning: boolean;
  serviceStatus: ManagerStatus;
  activeConnections: number;
  config: UnifiedServerConfig;
  // 添加对 serviceStatus 的便捷访问属性
  services?: Record<string, MCPServiceConnectionStatus>;
  totalTools?: number;
  availableTools?: string[];
}

// =========================
// 向后兼容性别名
// =========================

/**
 * 向后兼容：ServiceStatus 别名
 * 为了与现有代码保持兼容，暂时保留此别名
 * @deprecated 请使用 MCPServiceConnectionStatus
 */
export type ServiceStatus = MCPServiceConnectionStatus;
