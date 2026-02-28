/**
 * 配置相关类型导出
 */

// 应用配置相关类型
export type {
  LocalMCPServerConfig,
  SSEMCPServerConfig,
  StreamableHTTPMCPServerConfig,
  MCPServerConfig,
  MCPToolConfig,
  MCPServerToolsConfig,
  AppConfig,
  ModelScopeConfig,
  WebUIConfig,
  PlatformsConfig,
  PlatformConfig,
} from "./app";

// 连接配置相关类型
export type {
  ConnectionConfig,
  EndpointConfig,
  LoadBalancingConfig,
} from "./connection";

// 服务器配置相关类型
export type {
  ClientStatus as ConfigClientStatus,
  ServerInfo,
  RestartStatus,
} from "./server";
