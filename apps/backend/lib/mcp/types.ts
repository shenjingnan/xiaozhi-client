/**
 * MCP 核心库类型定义
 * 从 @xiaozhi-client/mcp-core 重新导出公共类型，保留 backend 特有的类型定义
 *
 * 此文件的作用：
 * 1. 重新导出 mcp-core 包中的公共类型，方便 backend 代码使用
 * 2. 保留 backend 特有的类型定义（如 ToolCallResult）
 * 3. 提供向后兼容的类型别名（如 ServiceStatus）
 */

// =========================
// 从 mcp-core 导入类型（用于内部使用）
// =========================

import type { MCPServiceConnectionStatus } from "@xiaozhi-client/mcp-core";

// =========================
// 从 mcp-core 重新导出公共类型
// =========================

export type {
  // 配置相关
  MCPServiceConfig,
  ModelScopeSSEOptions,
  InternalMCPServiceConfig,
  ToolStatusFilter,
  UnifiedServerConfig,
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
  // 传输相关
  MCPServerTransport,
  // 事件相关
  MCPServiceEventCallbacks,
} from "@xiaozhi-client/mcp-core";

export {
  // 枚举
  MCPTransportType,
  ConnectionState,
  ToolCallErrorCode,
  // 类
  ToolCallError,
  // 类型守卫
  isValidToolJSONSchema,
  ensureToolJSONSchema,
} from "@xiaozhi-client/mcp-core";

// =========================
// Backend 特有的类型定义
// =========================

/**
 * 工具调用结果接口（Backend 特有）
 * 使用简化的类型定义，保持向后兼容性
 *
 * 注意：这与 @xiaozhi-client/mcp-core 中的 ToolCallResult 类型不同
 * mcp-core 导出的是 CompatibilityCallToolResult（MCP SDK 官方类型）
 * 这里保留的是 backend 内部使用的简化版本
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
export type ServiceStatus = MCPServiceConnectionStatus;
