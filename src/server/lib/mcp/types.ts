/**
 * MCP 核心库类型定义
 * 统一管理所有 MCP 相关的类型定义，避免重复定义和导入路径混乱
 *
 * 说明：
 * - 大多数类型从 @xiaozhi-client/mcp-core 重新导出
 * - ToolCallResult 保持自定义定义，与 endpoint 包保持兼容
 * - UnifiedServerStatus 保持自定义定义（无 transportCount）
 */

// 先导入需要在自定义类型中使用的类型
import type {
  MCPServiceConnectionStatus,
  ManagerStatus,
  UnifiedServerConfig,
} from "@xiaozhi-client/mcp-core";

// =========================
// 从 mcp-core 重新导出的类型（完全相同）
// =========================

export type {
  // 配置相关
  MCPServiceConfig,
  InternalMCPServiceConfig,
  ModelScopeSSEOptions,
  // 状态相关
  MCPServiceStatus,
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
  // 重新导出上面导入的类型
  ManagerStatus,
  UnifiedServerConfig,
  MCPServiceConnectionStatus,
} from "@xiaozhi-client/mcp-core";

// =========================
// 枚举导出
// =========================

export {
  MCPTransportType,
  ConnectionState,
  ToolCallErrorCode,
} from "@xiaozhi-client/mcp-core";

// =========================
// 类导出
// =========================

export { ToolCallError } from "@xiaozhi-client/mcp-core";

// =========================
// 函数导出
// =========================

export {
  isValidToolJSONSchema,
  ensureToolJSONSchema,
} from "@xiaozhi-client/mcp-core";

// =========================
// 保留的自定义类型（与 mcp-core 有差异）
// =========================

/**
 * 工具调用结果接口
 * 使用简化的类型定义，保持向后兼容性
 * 注意：这与 mcp-core 的 ToolCallResult（CompatibilityCallToolResult）不同
 * mcp-core 使用 SDK 类型，这里保持自定义接口以兼容 endpoint 包
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
 * 注意：与 mcp-core 的 UnifiedServerStatus 不同（缺少 transportCount）
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
