/**
 * MCP 服务相关类型定义
 *
 * 包含 MCP 服务器配置、工具配置等类型
 */

/**
 * 本地 MCP 服务配置
 */
export interface LocalMCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/**
 * SSE MCP 服务配置
 */
export interface SSEMCPServerConfig {
  type: "sse";
  url: string;
  headers?: Record<string, string>;
}

/**
 * HTTP MCP 服务配置
 */
export interface HTTPMCPServerConfig {
  type?: "http" | "streamable-http"; // 可选，默认就是 http
  url: string;
  headers?: Record<string, string>;
}

/**
 * 向后兼容的别名
 * @deprecated 使用 HTTPMCPServerConfig 代替
 */
export type StreamableHTTPMCPServerConfig = HTTPMCPServerConfig;

/**
 * 统一的 MCP 服务配置
 */
export type MCPServerConfig =
  | LocalMCPServerConfig
  | SSEMCPServerConfig
  | HTTPMCPServerConfig;

/**
 * MCP 工具配置
 */
export interface MCPToolConfig {
  description?: string;
  enable: boolean;
  usageCount?: number; // 工具使用次数
  lastUsedTime?: string; // 最后使用时间（ISO 8601 格式）
}

/**
 * MCP 服务器工具配置
 */
export interface MCPServerToolsConfig {
  tools: Record<string, MCPToolConfig>;
}
