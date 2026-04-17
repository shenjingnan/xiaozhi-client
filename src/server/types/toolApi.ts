/**
 * 工具添加 API 相关类型定义
 * 支持多种工具类型的添加，包括 MCP 工具、Coze 工作流等
 *
 * 注意：此文件包含服务端特有的类型定义，并重新导出共享类型
 * 共享类型定义位于 ../../types/api/toolApi.ts
 */

import type { JSONSchema as LibJSONSchema } from "../lib/mcp/types.js";

/**
 * JSON Schema 类型
 * 重新导出 ../lib/mcp/types.js 中的 JSONSchema
 *
 * 注意：此类型与 ../../types/index.js 中的 JSONSchema 相同
 * TODO：将来应从 shared-types 导入 JSONSchema 以消除重复定义
 */
export type JSONSchema = LibJSONSchema;

/**
 * 工具处理器配置相关类型
 *
 * 注意：这些类型与 ../../types/mcp/tool-definition.ts 中定义的类型相同
 * TODO：将 toolApi.ts 的类型迁移为从 shared-types 导入，消除重复定义
 * 目前保持本地定义以避免 TypeScript 子路径解析问题（影响 tts、asr 等其他包）
 *
 * 权威定义位置：src/types/mcp/tool-definition.ts
 */
export type ToolHandlerConfig =
  | MCPHandlerConfig
  | ProxyHandlerConfig
  | HttpHandlerConfig
  | FunctionHandlerConfig;

/**
 * MCP 处理器配置
 * 用于标准 MCP 服务中的工具
 */
export interface MCPHandlerConfig {
  type: "mcp";
  config: {
    serviceName: string;
    toolName: string;
  };
}

/**
 * 代理处理器配置
 * 用于第三方平台代理（如 Coze、OpenAI 等）
 */
export interface ProxyHandlerConfig {
  type: "proxy";
  platform: "coze" | "openai" | "anthropic" | "custom";
  config: Record<string, unknown>;
}

/**
 * HTTP 处理器配置
 * 用于 HTTP API 工具
 */
export interface HttpHandlerConfig {
  type: "http";
  config: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
  };
}

/**
 * 函数处理器配置
 * 用于自定义函数工具
 */
export interface FunctionHandlerConfig {
  type: "function";
  config: {
    module: string;
    function: string;
  };
}

/**
 * CustomMCP 工具基础接口
 *
 * 注意：此类型与 ../../types/mcp/tool-definition.ts 中的 CustomMCPTool 相同
 * TODO：将来应从 shared-types 导入 CustomMCPTool 以消除重复定义
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
 * 用于 API 响应，使用扁平的统计信息结构
 *
 * 注意：此类型与 ../../types/mcp/tool-definition.ts 中的 CustomMCPToolWithStats 类似
 * 但不包含 `enabled` 字段。如需完整功能，请从 ../../types/mcp/tool-definition.ts 导入
 */
export interface CustomMCPToolWithStats extends CustomMCPToolBase {
  /** 工具使用次数（扁平结构，与 API 响应格式一致） */
  usageCount?: number;
  /** 最后使用时间（ISO 8601 格式） */
  lastUsedTime?: string;
}

// ==================== 重新导出共享类型 ====================
// 以下类型从 ../../types/api/toolApi.ts 重新导出，消除重复定义

/**
 * 工具类型枚举
 * @see ../../types/api/toolApi.ts
 */
export { ToolType, ToolValidationError } from "../../types/api/toolApi.js";

/**
 * 工具数据类型
 * @see ../../types/api/toolApi.ts
 */
export type {
  MCPToolData,
  CozeWorkflowData,
  HttpApiToolData,
  FunctionToolData,
  AddCustomToolRequest,
  AddToolResponse,
  ToolMetadata,
  ToolConfigOptions,
  ToolValidationErrorDetail,
} from "../../types/api/toolApi.js";
