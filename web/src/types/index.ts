export interface LocalMCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface SSEMCPServerConfig {
  type: "sse";
  url: string;
}

export type MCPServerConfig = LocalMCPServerConfig | SSEMCPServerConfig;

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

export interface AppConfig {
  mcpEndpoint: string;
  mcpServers: Record<string, MCPServerConfig>;
  mcpServerConfig?: Record<string, MCPServerToolsConfig>;
  connection?: ConnectionConfig;
  modelscope?: ModelScopeConfig;
}

export interface ClientStatus {
  status: "connected" | "disconnected";
  mcpEndpoint: string;
  activeMCPServers: string[];
  lastHeartbeat?: number;
}
