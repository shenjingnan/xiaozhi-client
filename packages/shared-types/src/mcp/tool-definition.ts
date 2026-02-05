/**
 * CustomMCP 工具类型定义
 * 前后端共享的权威类型定义
 *
 * 这是项目中 CustomMCPTool 相关类型的唯一权威来源。
 * 所有其他包都应该从此文件导入类型，而不是定义自己的版本。
 */

import type { JSONSchema } from "./schema.js";

/**
 * 工具处理器配置联合类型
 * 支持多种工具处理器类型
 */
export type ToolHandlerConfig =
  | MCPHandlerConfig
  | ProxyHandlerConfig
  | HttpHandlerConfig
  | FunctionHandlerConfig
  | ScriptHandlerConfig
  | ChainHandlerConfig;

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
  config: {
    // Coze 平台配置
    workflow_id?: string;
    bot_id?: string;
    api_key?: string;
    base_url?: string;
    // 通用配置
    timeout?: number;
    retry_count?: number;
    retry_delay?: number;
    headers?: Record<string, string>;
    params?: Record<string, unknown>;
  };
}

/**
 * HTTP 处理器配置
 * 用于 HTTP API 工具
 */
export interface HttpHandlerConfig {
  type: "http";
  config: {
    url: string;
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    headers?: Record<string, string>;
    timeout?: number;
    retry_count?: number;
    retry_delay?: number;
    auth?: {
      type: "bearer" | "basic" | "api_key";
      token?: string;
      username?: string;
      password?: string;
      api_key?: string;
      api_key_header?: string;
    };
    body_template?: string;
    response_mapping?: {
      success_path?: string;
      error_path?: string;
      data_path?: string;
    };
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
    timeout?: number;
    context?: Record<string, unknown>;
  };
}

/**
 * 脚本处理器配置
 * 用于脚本工具
 */
export interface ScriptHandlerConfig {
  type: "script";
  config: {
    script: string;
    interpreter?: "node" | "python" | "bash";
    timeout?: number;
    env?: Record<string, string>;
  };
}

/**
 * 链式处理器配置
 * 用于链式调用多个工具
 */
export interface ChainHandlerConfig {
  type: "chain";
  config: {
    tools: string[];
    mode: "sequential" | "parallel";
    error_handling: "stop" | "continue" | "retry";
  };
}

/**
 * CustomMCP 工具基础接口
 * 前后端共享的工具类型定义
 */
export interface CustomMCPTool {
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
 */
export interface CustomMCPToolWithStats extends CustomMCPTool {
  /** 工具是否启用 (true=已启用，false=已禁用) */
  enabled?: boolean;
  /** 工具使用次数（扁平结构，与 API 响应格式一致） */
  usageCount?: number;
  /** 最后使用时间（ISO 8601 格式） */
  lastUsedTime?: string;
}

/**
 * 配置文件中的 CustomMCP 工具
 * 使用嵌套的 stats 结构以保持 JSON 可读性
 */
export interface CustomMCPToolConfig extends CustomMCPTool {
  /** 使用统计信息（嵌套结构，仅用于配置文件） */
  stats?: {
    usageCount?: number;
    lastUsedTime?: string;
  };
}
