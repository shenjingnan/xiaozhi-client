/**
 * 工具添加 API 相关类型定义
 * 支持多种工具类型的添加，包括 MCP 工具、Coze 工作流等
 *
 * @deprecated 此文件中的类型定义已迁移到 @xiaozhi-client/shared-types
 * 请直接从 shared-types 导入相关类型
 * 此文件保留用于向后兼容
 */

import type { JSONSchema as LibJSONSchema } from "@/lib/mcp/types.js";
import type { CozeWorkflow, WorkflowParameterConfig } from "./coze.js";

// 从 shared-types 重新导出核心类型（使用类型导入避免运行时依赖）
// 注意：由于构建系统的限制，这里使用本地类型定义而非导入
// 在使用时应该从 @xiaozhi-client/shared-types 导入

/**
 * CustomMCP 工具基础接口
 *
 * @deprecated 请从 @xiaozhi-client/shared-types 导入
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
 *
 * @deprecated 请从 @xiaozhi-client/shared-types 导入
 */
export interface CustomMCPToolWithStats extends CustomMCPToolBase {
  /** 工具使用次数（扁平结构，与 API 响应格式一致） */
  usageCount?: number;
  /** 最后使用时间（ISO 8601 格式） */
  lastUsedTime?: string;
}

/**
 * 配置文件中的 CustomMCP 工具
 *
 * @deprecated 请从 @xiaozhi-client/shared-types 导入
 */
export interface CustomMCPToolConfig extends CustomMCPToolBase {
  /** 使用统计信息（嵌套结构，仅用于配置文件） */
  stats?: {
    usageCount?: number;
    lastUsedTime?: string;
  };
}

// 向后兼容的类型别名
export type CustomMCPTool = CustomMCPToolBase;

// 本地定义处理器配置类型，用于向后兼容
export interface MCPHandlerConfig {
  type: "mcp";
  config: {
    serviceName: string;
    toolName: string;
  };
}

export interface ProxyHandlerConfig {
  type: "proxy";
  platform: "coze" | "openai" | "anthropic" | "custom";
  config: Record<string, unknown>;
}

export interface HttpHandlerConfig {
  type: "http";
  config: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
  };
}

export interface FunctionHandlerConfig {
  type: "function";
  config: {
    module: string;
    function: string;
  };
}

export type ToolHandlerConfig =
  | MCPHandlerConfig
  | ProxyHandlerConfig
  | HttpHandlerConfig
  | FunctionHandlerConfig;

/**
 * JSON Schema 类型
 * 重新导出 @/lib/mcp/types.js 中的 JSONSchema
 */
export type JSONSchema = LibJSONSchema;

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
  context?: Record<string, unknown>;
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
  details?: unknown;
  /** 建议的解决方案 */
  suggestions?: string[];
}

/**
 * 添加工具的响应数据
 */
export interface AddToolResponse {
  /** 成功添加的工具 */
  tool: unknown;
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
 *
 * @deprecated 使用 CustomMCPToolWithStats 或 CustomMCPToolConfig 代替
 */
export interface ExtendedCustomMCPTool {
  /** 基础工具配置 */
  name: string;
  description: string;
  inputSchema: unknown;
  handler: unknown;
  /** 使用统计信息 */
  stats?: {
    usageCount?: number;
    lastUsedTime?: string;
  };
  /** 工具元数据 */
  metadata?: ToolMetadata;
  /** 配置选项 */
  config?: ToolConfigOptions;
}
