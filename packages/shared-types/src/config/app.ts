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
}

/**
 * 可流式 HTTP MCP 服务器配置
 */
export interface StreamableHTTPMCPServerConfig {
  type?: "streamable-http"; // 可选，因为默认就是 streamable-http
  url: string;
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