/**
 * 配置类型定义
 *
 * 包含所有配置相关的接口和类型定义
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
  type?: "http" | "streamable-http"; // 可选，默认就是 http
  url: string;
  headers?: Record<string, string>;
}

// 向后兼容的别名
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
  usageCount?: number; // 工具使用次数
  lastUsedTime?: string; // 最后使用时间（ISO 8601 格式）
}

export interface MCPServerToolsConfig {
  tools: Record<string, MCPToolConfig>;
}

export interface ConnectionConfig {
  heartbeatInterval?: number; // 心跳检测间隔（毫秒），默认30000
  heartbeatTimeout?: number; // 心跳超时时间（毫秒），默认10000
  reconnectInterval?: number; // 重连间隔（毫秒），默认5000
}

export interface ModelScopeConfig {
  apiKey?: string; // ModelScope API 密钥
}

export interface WebUIConfig {
  port?: number; // Web UI 端口号，默认 9999
  autoRestart?: boolean; // 是否在配置更新后自动重启服务，默认 true
}

// 工具调用日志配置接口
// TTS 配置接口
export interface TTSConfig {
  appid?: string; // 应用 ID
  accessToken?: string; // 访问令牌
  voice_type?: string; // 声音类型
  encoding?: string; // 编码格式（默认 wav）
  cluster?: string; // 集群类型
  endpoint?: string; // WebSocket 端点
}

// ASR 配置接口
export interface ASRConfig {
  appid?: string; // 应用 ID
  accessToken?: string; // 访问令牌
  cluster?: string; // 集群类型（默认：volcengine_streaming_common）
  wsUrl?: string; // WebSocket 端点
}

// LLM 配置接口
export interface LLMConfig {
  model: string; // 模型名称
  apiKey: string; // API 密钥
  baseURL: string; // API 基础地址
}

export interface ToolCallLogConfig {
  maxRecords?: number; // 最大记录条数，默认 100
  logFilePath?: string; // 自定义日志文件路径（可选）
}

// CustomMCP 相关接口定义

// 代理处理器配置
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
  body_template?: string; // 支持模板变量替换
  response_mapping?: {
    success_path?: string; // JSONPath 表达式
    error_path?: string;
    data_path?: string;
  };
}

// 函数处理器配置
export interface FunctionHandlerConfig {
  type: "function";
  module: string; // 模块路径
  function: string; // 函数名
  timeout?: number;
  context?: Record<string, unknown>; // 函数执行上下文
}

// 脚本处理器配置
export interface ScriptHandlerConfig {
  type: "script";
  script: string; // 脚本内容或文件路径
  interpreter?: "node" | "python" | "bash";
  timeout?: number;
  env?: Record<string, string>; // 环境变量
}

// 链式处理器配置
export interface ChainHandlerConfig {
  type: "chain";
  tools: string[]; // 要链式调用的工具名称
  mode: "sequential" | "parallel"; // 执行模式
  error_handling: "stop" | "continue" | "retry"; // 错误处理策略
}

// MCP 处理器配置（用于同步的工具）
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
// TODO: 注意：此定义应与 @xiaozhi-client/shared-types 中的 CustomMCPToolConfig 保持一致
// 未来将迁移到从 shared-types 导入
export interface CustomMCPTool {
  // 确保必填字段
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: HandlerConfig;

  // 使用统计信息（可选）
  stats?: {
    usageCount?: number; // 工具使用次数
    lastUsedTime?: string; // 最后使用时间（ISO 8601格式）
  };
}

// CustomMCP 配置接口
export interface CustomMCPConfig {
  tools: CustomMCPTool[];
}

// Web 服务器实例接口（用于配置更新通知）
export interface WebServerInstance {
  broadcastConfigUpdate(config: AppConfig): void;
}

export interface PlatformsConfig {
  [platformName: string]: PlatformConfig;
}

export interface PlatformConfig {
  token?: string;
}

/**
 * 扣子平台配置接口
 */
export interface CozePlatformConfig extends PlatformConfig {
  /** 扣子 API Token */
  token: string;
}

export interface AppConfig {
  mcpEndpoint: string | string[];
  mcpServers: Record<string, MCPServerConfig>;
  mcpServerConfig?: Record<string, MCPServerToolsConfig>;
  customMCP?: CustomMCPConfig; // 新增 customMCP 配置支持
  connection?: ConnectionConfig; // 连接配置（可选，用于向后兼容）
  modelscope?: ModelScopeConfig; // ModelScope 配置（可选）
  webUI?: WebUIConfig; // Web UI 配置（可选）
  platforms?: PlatformsConfig; // 平台配置（可选）
  toolCallLog?: ToolCallLogConfig; // 工具调用日志配置（可选）
  tts?: TTSConfig; // TTS 配置（可选）
  asr?: ASRConfig; // ASR 配置（可选）
  llm?: LLMConfig; // LLM 配置（可选）
}

// 默认连接配置
export const DEFAULT_CONNECTION_CONFIG: Required<ConnectionConfig> = {
  heartbeatInterval: 30000, // 30秒心跳间隔
  heartbeatTimeout: 10000, // 10秒心跳超时
  reconnectInterval: 5000, // 5秒重连间隔
};

// 配置更新事件负载类型
export interface ConfigUpdatePayload {
  type:
    | "endpoint"
    | "customMCP"
    | "config"
    | "serverTools"
    | "connection"
    | "modelscope"
    | "webui"
    | "platform"
    | "tts";
  timestamp: Date;
  serviceName?: string;
  platformName?: string;
}

// 配置错误事件负载类型
export interface ConfigErrorPayload {
  error: Error;
  operation: string;
}
