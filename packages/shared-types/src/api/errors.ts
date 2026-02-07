/**
 * API 错误类型定义
 */

/**
 * MCP 错误代码枚举
 */
export enum MCPErrorCode {
  // 通用错误
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
  INVALID_REQUEST = "INVALID_REQUEST",
  METHOD_NOT_FOUND = "METHOD_NOT_FOUND",
  INVALID_PARAMS = "INVALID_PARAMS",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  PARSE_ERROR = "PARSE_ERROR",

  // 连接相关错误
  CONNECTION_ERROR = "CONNECTION_ERROR",
  CONNECTION_TIMEOUT = "CONNECTION_TIMEOUT",
  CONNECTION_CLOSED = "CONNECTION_CLOSED",

  // 工具相关错误
  TOOL_NOT_FOUND = "TOOL_NOT_FOUND",
  TOOL_EXECUTION_ERROR = "TOOL_EXECUTION_ERROR",
  TOOL_TIMEOUT = "TOOL_TIMEOUT",
  TOOL_VALIDATION_ERROR = "TOOL_VALIDATION_ERROR",

  // 扣子平台错误
  COZE_API_ERROR = "COZE_API_ERROR",
  COZE_WORKSPACE_NOT_FOUND = "COZE_WORKSPACE_NOT_FOUND",
  COZE_WORKFLOW_NOT_FOUND = "COZE_WORKFLOW_NOT_FOUND",
  COZE_PERMISSION_DENIED = "COZE_PERMISSION_DENIED",

  // 配置相关错误
  CONFIG_ERROR = "CONFIG_ERROR",
  CONFIG_NOT_FOUND = "CONFIG_NOT_FOUND",
  CONFIG_INVALID = "CONFIG_INVALID",
}

/**
 * API 错误接口
 */
export interface ApiError {
  /** 错误代码 */
  code: MCPErrorCode;
  /** 错误消息 */
  message: string;
  /** 错误详情 */
  details?: any;
  /** 错误堆栈（开发环境） */
  stack?: string;
}

/**
 * 工具验证错误
 */
export interface ToolValidationError {
  /** 错误代码 */
  code: string;
  /** 错误消息 */
  message: string;
  /** 验证字段名称 */
  field?: string;
  /** 错误详情 */
  details?: any;
}

/**
 * 扣子 API 错误响应结构
 */
export interface CozeApiErrorResponse {
  /** 错误代码 */
  code?: number;
  /** 错误消息 */
  msg?: string;
  /** 请求ID */
  logid?: string;
  /** 其他未知字段 */
  [key: string]: unknown;
}

/**
 * 扣子 API 错误响应
 */
export interface CozeApiError extends Error {
  /** 错误代码 */
  code: string;
  /** HTTP 状态码 */
  statusCode?: number;
  /** 原始响应数据 */
  response?: CozeApiErrorResponse;
}
