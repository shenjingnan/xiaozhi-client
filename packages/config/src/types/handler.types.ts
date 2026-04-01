/**
 * Handler 配置相关类型定义
 *
 * 包含各种处理器（Proxy、HTTP、Function、Script、Chain、MCP）的配置类型
 */

/**
 * 代理处理器配置
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
 */
export interface HttpHandlerConfig {
  type: "http";
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
  body_template?: string; // 支持模板变量替换
  response_mapping?: {
    success_path?: string; // JSONPath 表达式
    error_path?: string;
    data_path?: string;
  };
}

/**
 * 函数处理器配置
 */
export interface FunctionHandlerConfig {
  type: "function";
  module: string; // 模块路径
  function: string; // 函数名
  timeout?: number;
  context?: Record<string, unknown>; // 函数执行上下文
}

/**
 * 脚本处理器配置
 */
export interface ScriptHandlerConfig {
  type: "script";
  script: string; // 脚本内容或文件路径
  interpreter?: "node" | "python" | "bash";
  timeout?: number;
  env?: Record<string, string>; // 环境变量
}

/**
 * 链式处理器配置
 */
export interface ChainHandlerConfig {
  type: "chain";
  tools: string[]; // 要链式调用的工具名称
  mode: "sequential" | "parallel"; // 执行模式
  error_handling: "stop" | "continue" | "retry"; // 错误处理策略
}

/**
 * MCP 处理器配置（用于同步的工具）
 */
export interface MCPHandlerConfig {
  type: "mcp";
  config: {
    serviceName: string;
    toolName: string;
  };
}

/**
 * 统一的 Handler 配置类型
 */
export type HandlerConfig =
  | ProxyHandlerConfig
  | HttpHandlerConfig
  | FunctionHandlerConfig
  | ScriptHandlerConfig
  | ChainHandlerConfig
  | MCPHandlerConfig;
