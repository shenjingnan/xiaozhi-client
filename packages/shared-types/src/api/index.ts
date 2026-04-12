/**
 * API 相关类型导出
 */

// 分页相关类型（保留用于未来扩展）
export type { PaginationParams, PaginatedResponse } from "./common";

// 工具 API 相关类型
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
} from "./toolApi";

export {
  ToolType,
  ToolValidationError as ApiToolValidationError,
} from "./toolApi";

// API 错误类型
export type {
  ApiError,
  ToolValidationError as ApiValidationToolValidationError,
  CozeApiError as ApiCozeApiError,
} from "./errors";

export { MCPErrorCode as ApiMCPErrorCode } from "./errors";

// API 验证相关类型
export type {
  ValidationRule,
  FieldValidation,
  ValidationResult,
  ValidationError,
  BatchValidationConfig,
} from "./validation";
