/**
 * 工具添加 API 相关类型定义
 *
 * 此文件从 @xiaozhi-client/shared-types 重新导出所有类型
 * 以消除跨包重复定义（DRY 原则）
 *
 * 权威定义位置：
 * - packages/shared-types/src/api/toolApi.ts
 * - packages/shared-types/src/mcp/tool-definition.ts
 * - packages/shared-types/src/mcp/schema.ts
 */

// 从 shared-types 导入所有工具 API 类型
export {
  ToolType,
  ToolValidationError,
} from "@xiaozhi-client/shared-types";

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

// 从 shared-types 导入工具处理器配置类型
export type {
  ToolHandlerConfig,
  MCPHandlerConfig,
  ProxyHandlerConfig,
  HttpHandlerConfig,
  FunctionHandlerConfig,
} from "@xiaozhi-client/shared-types";

// 从 shared-types 导入 CustomMCP 工具类型和 JSONSchema
export type {
  CustomMCPTool,
  CustomMCPToolWithStats,
  CustomMCPToolConfig,
  JSONSchema,
} from "@xiaozhi-client/shared-types";

// CustomMCPToolBase 作为 CustomMCPTool 的别名（向后兼容）
export type { CustomMCPTool as CustomMCPToolBase } from "@xiaozhi-client/shared-types";