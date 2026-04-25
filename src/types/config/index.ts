/**
 * 配置相关类型导出
 *
 * 统一从 app.ts 导出所有应用配置类型，connection.ts 和 server.ts
 * 提供连接和服务器专用类型。
 */

// 应用配置相关类型（唯一权威源）
export type {
  // MCP 服务配置
  HTTPMCPServerConfig,
  LocalMCPServerConfig,
  MCPServerConfig,
  MCPServerToolsConfig,
  MCPToolConfig,
  SSEMCPServerConfig,
  // 向后兼容别名
  StreamableHTTPMCPServerConfig,
  // 应用主配置
  AppConfig,
  // 子系统配置
  ASRConfig,
  CozePlatformConfig,
  LLMConfig,
  ModelScopeConfig,
  PlatformConfig,
  PlatformsConfig,
  ToolCallLogConfig,
  TTSConfig,
  WebUIConfig,
  // 连接配置（完整版，6 个字段）
  ConnectionConfig,
} from "./app";

// 连接/端点专用类型（EndpointConfig、LoadBalancingConfig 等）
export type {
  ConnectionConfig as ConfigConnectionConfig,
  EndpointConfig,
  LoadBalancingConfig,
} from "./connection";

// 服务器状态类型
export type {
  ClientStatus as ConfigClientStatus,
  ServerInfo,
  RestartStatus,
} from "./server";
