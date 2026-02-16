/**
 * API 相关类型导出
 */

// 通用 API 响应类型
export type {
  ApiErrorResponse,
  ApiResponse,
  ApiSuccessResponse,
  PaginatedResponse,
  PaginationParams,
} from "./common";
// API 错误类型
export type {
  ApiError,
  CozeApiError as ApiCozeApiError,
  ToolValidationError as ApiValidationToolValidationError,
} from "./errors";
export { MCPErrorCode as ApiMCPErrorCode } from "./errors";
// 工具 API 相关类型
export type {
  AddCustomToolRequest,
  AddToolResponse,
  CozeWorkflowData,
  ExtendedCustomMCPTool,
  FunctionToolData,
  HttpApiToolData,
  MCPToolData,
  ToolConfigOptions,
  ToolMetadata,
  ToolValidationErrorDetail,
} from "./toolApi";
export {
  ToolType,
  ToolValidationError as ApiToolValidationError,
} from "./toolApi";

// API 验证相关类型
export type {
  BatchValidationConfig,
  FieldValidation,
  ValidationError,
  ValidationResult,
  ValidationRule,
} from "./validation";
