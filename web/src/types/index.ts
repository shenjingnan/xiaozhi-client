export interface LocalMCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface SSEMCPServerConfig {
  type: "sse";
  url: string;
}

export interface StreamableHTTPMCPServerConfig {
  type?: "streamable-http"; // 可选，因为默认就是 streamable-http
  url: string;
}

export type MCPServerConfig =
  | LocalMCPServerConfig
  | SSEMCPServerConfig
  | StreamableHTTPMCPServerConfig;

export interface MCPToolConfig {
  description?: string;
  enable: boolean;
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

export interface AppConfig {
  mcpEndpoint: string;
  mcpServers: Record<string, MCPServerConfig>;
  mcpServerConfig?: Record<string, MCPServerToolsConfig>;
  connection?: ConnectionConfig;
  modelscope?: ModelScopeConfig;
  webUI?: WebUIConfig;
}

export interface ClientStatus {
  status: "connected" | "disconnected";
  mcpEndpoint: string;
  activeMCPServers: string[];
  lastHeartbeat?: number;
}
