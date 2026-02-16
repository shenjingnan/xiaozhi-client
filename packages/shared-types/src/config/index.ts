/**
 * 配置相关类型导出
 */

// 应用配置相关类型
// 重新导出 ConnectionConfig 以避免命名冲突，使用默认的 app.ts 中的定义
export type {
  AppConfig,
  ConnectionConfig,
  LocalMCPServerConfig,
  MCPServerConfig,
  MCPServerToolsConfig,
  MCPToolConfig,
  ModelScopeConfig,
  PlatformConfig,
  PlatformsConfig,
  SSEMCPServerConfig,
  StreamableHTTPMCPServerConfig,
  WebUIConfig,
} from "./app";
// 连接配置相关类型
export type {
  ConnectionConfig as ConfigConnectionConfig,
  EndpointConfig,
  LoadBalancingConfig,
} from "./connection";
// 服务器配置相关类型
export type {
  ClientStatus as ConfigClientStatus,
  RestartStatus,
  ServerInfo,
} from "./server";
