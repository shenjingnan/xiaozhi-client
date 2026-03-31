/**
 * 工具添加 API 相关类型定义
 * 支持多种工具类型的添加，包括 MCP 工具、Coze 工作流等
 *
 * 注意：此文件现在从 @xiaozhi-client/shared-types 重导出类型，
 * 以消除与 packages/shared-types/src/api/toolApi.ts 的重复定义。
 * 权威定义位置：packages/shared-types/src/api/toolApi.ts
 *
 * 注意：JSONSchema 类型保留本地定义，因为 backend 的 JSONSchema
 * 使用 MCP SDK 兼容格式（Record<string, unknown>），而 shared-types
 * 使用严格的递归格式（Record<string, JSONSchema>）。
 */

// =========================
// 本地类型定义（与 shared-types 不兼容）
// =========================

import type { JSONSchema as LibJSONSchema } from "@/lib/mcp/types.js";

// 从 shared-types 导入处理器配置类型（用于本地接口定义）
import type {
  FunctionHandlerConfig,
  HttpHandlerConfig,
  MCPHandlerConfig,
  ProxyHandlerConfig,
  ToolHandlerConfig as SharedToolHandlerConfig,
} from "@xiaozhi-client/shared-types";

// 使用本地别名以便在接口中使用
type ToolHandlerConfig = SharedToolHandlerConfig;

/**
 * JSON Schema 类型
 * 重新导出 @/lib/mcp/types.js 中的 JSONSchema
 *
 * 注意：此类型与 shared-types 的 JSONSchema 定义不同：
 * - backend 版本：Record<string, unknown>（宽松格式，兼容 MCP SDK）
 * - shared-types 版本：Record<string, JSONSchema>（严格递归格式）
 * 保持本地定义以确保 MCP SDK 兼容性
 */
export type JSONSchema = LibJSONSchema;

// 导出处理器配置类型
export type {
  ToolHandlerConfig,
  MCPHandlerConfig,
  ProxyHandlerConfig,
  HttpHandlerConfig,
  FunctionHandlerConfig,
};

/**
 * CustomMCP 工具基础接口
 * 使用 backend 本地的 JSONSchema 类型
 */
export interface CustomMCPToolBase {
  /** 工具唯一标识符 */
  name: string;
  /** 工具描述信息 */
  description: string;
  /** 工具输入参数的 JSON Schema 定义 */
  inputSchema: JSONSchema;
  /** 处理器配置 */
  handler: ToolHandlerConfig;
}

/**
 * 带统计信息的 CustomMCP 工具
 * 使用 backend 本地的 JSONSchema 类型
 * 用于 API 响应，使用扁平的统计信息结构
 */
export interface CustomMCPToolWithStats extends CustomMCPToolBase {
  /** 工具使用次数（扁平结构，与 API 响应格式一致） */
  usageCount?: number;
  /** 最后使用时间（ISO 8601 格式） */
  lastUsedTime?: string;
}

// =========================
// 从 shared-types 重导出的类型
// =========================

// 工具 API 数据类型
export type {
  MCPToolData,
  CozeWorkflowData,
  HttpApiToolData,
  FunctionToolData,
  AddCustomToolRequest,
  AddToolResponse,
  ToolMetadata,
  ToolConfigOptions,
  ExtendedCustomMCPTool,
  ToolValidationErrorDetail,
} from "@xiaozhi-client/shared-types";

// 导出枚举类型
export { ToolType, ToolValidationError } from "@xiaozhi-client/shared-types";
