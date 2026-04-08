/**
 * 工具添加 API 相关类型定义
 * 支持多种工具类型的添加，包括 MCP 工具、Coze 工作流等
 *
 * 这些类型从 @xiaozhi-client/shared-types 重新导出，消除重复定义
 * 权威定义位置：packages/shared-types/src/mcp/tool-definition.ts 和 packages/shared-types/src/api/toolApi.ts
 */

// 从 shared-types 导入核心工具类型
export type {
  ToolHandlerConfig,
  MCPHandlerConfig,
  ProxyHandlerConfig,
  HttpHandlerConfig,
  FunctionHandlerConfig,
  CustomMCPTool,
  CustomMCPToolWithStats,
  CustomMCPToolConfig,
  JSONSchema,
} from "@xiaozhi-client/shared-types";

// 从 shared-types 导入 API 相关类型
export type {
  MCPToolData,
  CozeWorkflowData,
  HttpApiToolData,
  FunctionToolData,
  AddCustomToolRequest,
  ToolValidationErrorDetail,
  AddToolResponse,
  ToolMetadata,
  ToolConfigOptions,
} from "@xiaozhi-client/shared-types";

// 导出枚举（作为值，同时包含类型）
export { ToolType, ToolValidationError } from "@xiaozhi-client/shared-types";

/**
 * CustomMCPToolBase 类型别名
 * 保持向后兼容，等同于 CustomMCPTool
 * @deprecated 请直接使用 CustomMCPTool
 */
import type { CustomMCPTool as _CustomMCPTool } from "@xiaozhi-client/shared-types";
export type CustomMCPToolBase = _CustomMCPTool;
