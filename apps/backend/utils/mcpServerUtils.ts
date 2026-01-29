/**
 * MCP 服务类型定义
 */

// 定义通信类型
export type MCPCommunicationType = "stdio" | "sse" | "streamable-http";

// 定义 MCP 服务配置类型（与客户端保持一致）
export interface LocalMCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface SSEMCPServerConfig {
  type: "sse";
  url: string;
  headers?: Record<string, string>;
}

export interface StreamableHTTPMCPServerConfig {
  type?: "streamable-http"; // 可选，因为默认就是 streamable-http
  url: string;
  headers?: Record<string, string>;
}

export type MCPServerConfig =
  | LocalMCPServerConfig
  | SSEMCPServerConfig
  | StreamableHTTPMCPServerConfig;
