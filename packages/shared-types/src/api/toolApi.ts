/**
 * 工具添加 API 相关类型定义
 * 支持多种工具类型的添加，包括 MCP 工具、Coze 工作流等
 */

import type { CozeWorkflow, WorkflowParameterConfig } from "../coze/index.js";
import type { CustomMCPToolWithStats } from "../mcp/index.js";

/**
 * 工具类型枚举
 */
export enum ToolType {
  /** MCP 工具（标准 MCP 服务中的工具） */
  MCP = "mcp",
  /** Coze 工作流工具 */
  COZE = "coze",
  /** HTTP API 工具（预留） */
  HTTP = "http",
  /** 自定义函数工具（预留） */
  FUNCTION = "function",
}

/**
 * MCP 工具数据
 * 用于将标准 MCP 服务中的工具添加到 customMCP.tools 配置中
 */
export interface MCPToolData {
  /** MCP 服务名称 */
  serviceName: string;
  /** 工具名称 */
  toolName: string;
  /** 可选的自定义名称 */
  customName?: string;
  /** 可选的自定义描述 */
  customDescription?: string;
}

/**
 * Coze 工作流数据
 * 保持与现有格式的兼容性
 */
export interface CozeWorkflowData {
  /** Coze 工作流信息 */
  workflow: CozeWorkflow;
  /** 可选的自定义名称 */
  customName?: string;
  /** 可选的自定义描述 */
  customDescription?: string;
  /** 可选的参数配置 */
  parameterConfig?: WorkflowParameterConfig;
}

/**
 * HTTP API 工具数据（预留）
 */
export interface HttpApiToolData {
  /** API 地址 */
  url: string;
  /** HTTP 方法 */
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  /** API 描述 */
  description: string;
  /** 请求头 */
  headers?: Record<string, string>;
  /** 请求体模板 */
  bodyTemplate?: string;
  /** 认证配置 */
  auth?: {
    type: "bearer" | "basic" | "api_key";
    token?: string;
    username?: string;
    password?: string;
    apiKey?: string;
    apiKeyHeader?: string;
  };
  /** 可选的自定义名称 */
  customName?: string;
  /** 可选的自定义描述 */
  customDescription?: string;
}

/**
 * 函数工具数据（预留）
 */
export interface FunctionToolData {
  /** 模块路径 */
  module: string;
  /** 函数名 */
  function: string;
  /** 函数描述 */
  description: string;
  /** 函数执行上下文 */
  context?: Record<string, any>;
  /** 超时时间 */
  timeout?: number;
  /** 可选的自定义名称 */
  customName?: string;
  /** 可选的自定义描述 */
  customDescription?: string;
}

/**
 * 添加自定义工具的统一请求接口
 */
export interface AddCustomToolRequest {
  /** 工具类型 */
  type: ToolType;
  /** 工具数据（根据类型不同而不同） */
  data: MCPToolData | CozeWorkflowData | HttpApiToolData | FunctionToolData;
}

/**
 * 工具验证错误类型
 */
export enum ToolValidationError {
  /** 无效的工具类型 */
  INVALID_TOOL_TYPE = "INVALID_TOOL_TYPE",
  /** 缺少必需字段 */
  MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",
  /** 工具不存在 */
  TOOL_NOT_FOUND = "TOOL_NOT_FOUND",
  /** 服务不存在 */
  SERVICE_NOT_FOUND = "SERVICE_NOT_FOUND",
  /** 工具名称冲突 */
  TOOL_NAME_CONFLICT = "TOOL_NAME_CONFLICT",
  /** 配置验证失败 */
  CONFIG_VALIDATION_FAILED = "CONFIG_VALIDATION_FAILED",
  /** 系统配置错误 */
  SYSTEM_CONFIG_ERROR = "SYSTEM_CONFIG_ERROR",
  /** 资源限制超出 */
  RESOURCE_LIMIT_EXCEEDED = "RESOURCE_LIMIT_EXCEEDED",
}

/**
 * 工具验证错误详情
 */
export interface ToolValidationErrorDetail {
  /** 错误类型 */
  error: ToolValidationError;
  /** 错误消息 */
  message: string;
  /** 错误详情 */
  details?: any;
  /** 建议的解决方案 */
  suggestions?: string[];
}

/**
 * 添加工具的响应数据
 */
export interface AddToolResponse {
  /** 成功添加的工具 */
  tool: any;
  /** 工具名称 */
  toolName: string;
  /** 工具类型 */
  toolType: ToolType;
  /** 添加时间戳 */
  addedAt: string;
}

/**
 * 工具元数据信息
 */
export interface ToolMetadata {
  /** 工具原始来源 */
  source: {
    type: "mcp" | "coze" | "http" | "function";
    serviceName?: string;
    toolName?: string;
    url?: string;
  };
  /** 添加时间 */
  addedAt: string;
  /** 最后更新时间 */
  updatedAt?: string;
  /** 版本信息 */
  version?: string;
}

/**
 * 工具配置选项
 */
export interface ToolConfigOptions {
  /** 是否启用工具（默认 true） */
  enabled?: boolean;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 重试次数 */
  retryCount?: number;
  /** 重试间隔（毫秒） */
  retryDelay?: number;
  /** 自定义标签 */
  tags?: string[];
  /** 工具分组 */
  group?: string;
}

/**
 * 扩展的 CustomMCPTool 接口
 * 包含额外的元数据信息
 * 扩展自 CustomMCPToolWithStats，添加元数据和配置选项
 */
export interface ExtendedCustomMCPTool extends CustomMCPToolWithStats {
  /** 工具元数据 */
  metadata?: ToolMetadata;
  /** 配置选项 */
  config?: ToolConfigOptions;
}
