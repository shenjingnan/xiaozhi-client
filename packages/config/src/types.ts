/**
 * 配置类型定义
 *
 * 定义所有配置相关的 TypeScript 类型
 */

// 本地 MCP 服务配置
export interface LocalMCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

// SSE MCP 服务配置
export interface SSEMCPServerConfig {
  type: "sse";
  url: string;
  headers?: Record<string, string>;
}

// HTTP MCP 服务配置
export interface HTTPMCPServerConfig {
  type?: "http" | "streamable-http";
  url: string;
  headers?: Record<string, string>;
}

/** @deprecated 使用 HTTPMCPServerConfig 代替 */
export type StreamableHTTPMCPServerConfig = HTTPMCPServerConfig;

// 统一的 MCP 服务配置
export type MCPServerConfig =
  | LocalMCPServerConfig
  | SSEMCPServerConfig
  | HTTPMCPServerConfig;

export interface MCPToolConfig {
  description?: string;
  enable: boolean;
  usageCount?: number;
  lastUsedTime?: string;
}

export interface MCPServerToolsConfig {
  tools: Record<string, MCPToolConfig>;
}

export interface ConnectionConfig {
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
  reconnectInterval?: number;
}

export interface ModelScopeConfig {
  apiKey?: string;
}

export interface WebUIConfig {
  port?: number;
  autoRestart?: boolean;
}

export interface ToolCallLogConfig {
  maxRecords?: number;
  logFilePath?: string;
}

// TTS 配置接口
export interface TTSConfig {
  appid?: string;
  accessToken?: string;
  voice_type?: string;
  encoding?: string;
  cluster?: string;
  endpoint?: string;
}

// ASR 配置接口
export interface ASRConfig {
  appid?: string;
  accessToken?: string;
  cluster?: string;
  wsUrl?: string;
}

// LLM 配置接口
export interface LLMConfig {
  model: string;
  apiKey: string;
  baseURL: string;
  prompt?: string;
}

// CustomMCP 相关接口定义

// 代理处理器配置
export interface ProxyHandlerConfig {
  type: "proxy";
  platform: "coze" | "openai" | "anthropic" | "custom";
  config: {
    workflow_id?: string;
    bot_id?: string;
    api_key?: string;
    base_url?: string;
    timeout?: number;
    retry_count?: number;
    retry_delay?: number;
    headers?: Record<string, string>;
    params?: Record<string, unknown>;
  };
}

// HTTP 处理器配置
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
  body_template?: string;
  response_mapping?: {
    success_path?: string;
    error_path?: string;
    data_path?: string;
  };
}

// 函数处理器配置
export interface FunctionHandlerConfig {
  type: "function";
  module: string;
  function: string;
  timeout?: number;
  context?: Record<string, unknown>;
}

// 脚本处理器配置
export interface ScriptHandlerConfig {
  type: "script";
  script: string;
  interpreter?: "node" | "python" | "bash";
  timeout?: number;
  env?: Record<string, string>;
}

// 链式处理器配置
export interface ChainHandlerConfig {
  type: "chain";
  tools: string[];
  mode: "sequential" | "parallel";
  error_handling: "stop" | "continue" | "retry";
}

// MCP 处理器配置
export interface MCPHandlerConfig {
  type: "mcp";
  config: {
    serviceName: string;
    toolName: string;
  };
}

export type HandlerConfig =
  | ProxyHandlerConfig
  | HttpHandlerConfig
  | FunctionHandlerConfig
  | ScriptHandlerConfig
  | ChainHandlerConfig
  | MCPHandlerConfig;

// CustomMCP 工具接口
export interface CustomMCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: HandlerConfig;
  stats?: {
    usageCount?: number;
    lastUsedTime?: string;
  };
}

// CustomMCP 配置接口
export interface CustomMCPConfig {
  tools: CustomMCPTool[];
}

// Web 服务器实例接口
export interface WebServerInstance {
  broadcastConfigUpdate(config: AppConfig): void;
}

export interface PlatformsConfig {
  [platformName: string]: PlatformConfig;
}

export interface PlatformConfig {
  token?: string;
}

/** 扣子平台配置接口 */
export interface CozePlatformConfig extends PlatformConfig {
  token: string;
}

export interface AppConfig {
  mcpEndpoint: string | string[];
  mcpServers: Record<string, MCPServerConfig>;
  mcpServerConfig?: Record<string, MCPServerToolsConfig>;
  customMCP?: CustomMCPConfig;
  connection?: ConnectionConfig;
  modelscope?: ModelScopeConfig;
  webUI?: WebUIConfig;
  platforms?: PlatformsConfig;
  toolCallLog?: ToolCallLogConfig;
  tts?: TTSConfig;
  asr?: ASRConfig;
  llm?: LLMConfig;
}
