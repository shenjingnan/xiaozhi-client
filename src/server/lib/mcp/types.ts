/**
 * 服务端 MCP 类型定义
 *
 * 统一从 @/mcp-core re-export 核心类型，仅保留服务端特有的差异类型。
 * 详见 mcp-core/types.ts 了解完整类型定义。
 */

// 本地差异类型需要用到的类型
import type { MCPServiceConnectionStatus } from "@/mcp-core";

// =========================
// 从 mcp-core barrel export re-export 的类型
// =========================

// 类型别名
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
  ToolCallParams,
  ValidatedToolCallParams,
  ToolCallValidationOptions,
  CustomMCPTool,
  JSONSchema,
  // 传输相关
  MCPServerTransport,
  // 事件相关
  MCPServiceEventCallbacks,
} from "@/mcp-core";

// 枚举
export {
  MCPTransportType,
  ConnectionState,
  ToolCallErrorCode,
} from "@/mcp-core";

// 类
export { ToolCallError } from "@/mcp-core";

// 类型守卫函数
export { isValidToolJSONSchema, ensureToolJSONSchema } from "@/mcp-core";

// =========================
// 从 @/mcp-core 补充导出（之前通过深路径访问的类型）
// =========================

export type {
  MCPTransportTypeString,
  MCPTransportTypeInput,
  HeartbeatConfig,
  LegacyMCPServiceConfig,
  InternalMCPServiceConfig,
  ToolStatusFilter,
} from "@/mcp-core";

// =========================
// 本地差异类型（与 mcp-core 版本有明确区别）
// =========================

/**
 * 工具调用结果类型（从 mcp-core 导入的 canonical 定义）
 *
 * canonical 定义位于 mcp-core/types.ts，此处仅做 re-export。
 */
export type { ToolCallResult, CoreToolCallResult } from "@/mcp-core";

// =========================
// 向后兼容性别名
// =========================

/**
 * 向后兼容：ServiceStatus 别名
 * @deprecated 请使用 MCPServiceConnectionStatus
 */
export type ServiceStatus = MCPServiceConnectionStatus;
