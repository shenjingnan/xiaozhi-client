/**
 * 应用配置相关类型定义
 */

// 连接配置接口
export interface ConnectionConfig {
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  connectionTimeout?: number;
  autoReconnect?: boolean;
}

/**
 * 本地 MCP 服务器配置
 */
export interface LocalMCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/**
 * SSE MCP 服务器配置
 */
export interface SSEMCPServerConfig {
  type: "sse";
  url: string;
  /** 请求头 */
  headers?: Record<string, string>;
}

/**
 * 可流式 HTTP MCP 服务器配置
 */
export interface StreamableHTTPMCPServerConfig {
  type?: "streamable-http"; // 可选，因为默认就是 streamable-http
  url: string;
  /** 请求头 */
  headers?: Record<string, string>;
}

/**
 * MCP 服务器配置联合类型
 */
export type MCPServerConfig =
  | LocalMCPServerConfig
  | SSEMCPServerConfig
  | StreamableHTTPMCPServerConfig;

/**
 * MCP 工具配置
 */
export interface MCPToolConfig {
  description?: string;
  enable: boolean;
  usageCount?: number;
  lastUsedTime?: string;
}

/**
 * MCP 服务器工具配置
 */
export interface MCPServerToolsConfig {
  tools: Record<string, MCPToolConfig>;
}

/**
 * 应用主配置接口
 */
export interface AppConfig {
  mcpEndpoint: string | string[];
  mcpServers: Record<string, MCPServerConfig>;
  mcpServerConfig?: Record<string, MCPServerToolsConfig>;
  connection?: ConnectionConfig;
  modelscope?: ModelScopeConfig;
  webUI?: WebUIConfig;
  platforms?: PlatformsConfig;
  /** ASR（语音识别）配置 */
  asr?: ASRConfig;
  /** TTS（语音合成）配置 */
  tts?: TTSConfig;
  /** LLM（大语言模型）配置 */
  llm?: LLMConfig;
}

/**
 * ModelScope 配置
 */
export interface ModelScopeConfig {
  apiKey?: string;
}

/**
 * Web UI 配置
 */
export interface WebUIConfig {
  port?: number;
  autoRestart?: boolean;
}

/**
 * 平台配置
 */
export interface PlatformsConfig {
  [platformName: string]: PlatformConfig;
}

/**
 * 平台配置接口
 */
export interface PlatformConfig {
  token?: string;
}

/**
 * ASR（语音识别）配置接口
 */
export interface ASRConfig {
  /** 应用 ID */
  appid?: string;
  /** 访问令牌 */
  accessToken?: string;
  /** 集群类型 */
  cluster?: string;
  /** WebSocket 端点 */
  wsUrl?: string;
  /** VAD 端点检测窗口大小(ms)，启用服务端 VAD 判停
   *  设为 0 或不传则禁用服务端 VAD，回退到客户端静音超时
   *  推荐值: 800，最小值: 200 */
  vadEndWindowSize?: number;
}

/**
 * TTS（语音合成）配置接口
 */
export interface TTSConfig {
  /** 应用 ID */
  appid?: string;
  /** 访问令牌 */
  accessToken?: string;
  /** 声音类型 */
  voice_type?: string;
  /** 编码格式 */
  encoding?: string;
  /** 集群类型 */
  cluster?: string;
  /** WebSocket 端点 */
  endpoint?: string;
}

/**
 * LLM（大语言模型）配置接口
 */
export interface LLMConfig {
  /** 模型名称 */
  model: string;
  /** API 密钥 */
  apiKey: string;
  /** API 基础地址 */
  baseURL: string;
  /** 自定义系统提示词 */
  prompt?: string;
}
