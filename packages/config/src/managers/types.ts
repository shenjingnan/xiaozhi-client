/**
 * 管理器类型定义
 *
 * 重新导出所有配置类型，供管理器使用
 */

export type {
  // 配置接口
  AppConfig,
  ConnectionConfig,
  ModelScopeConfig,
  WebUIConfig,
  ToolCallLogConfig,
  TTSConfig,
  ASRConfig,
  LLMConfig,
  PlatformsConfig,
  PlatformConfig,
  CozePlatformConfig,
  CustomMCPConfig,
  // MCP 相关接口
  MCPServerConfig,
  LocalMCPServerConfig,
  SSEMCPServerConfig,
  HTTPMCPServerConfig,
  MCPToolConfig,
  MCPServerToolsConfig,
  // CustomMCP 接口
  CustomMCPTool,
  HandlerConfig,
  ProxyHandlerConfig,
  HttpHandlerConfig,
  FunctionHandlerConfig,
  ScriptHandlerConfig,
  ChainHandlerConfig,
  MCPHandlerConfig,
  // Web 服务器接口
  WebServerInstance,
} from "../types.js";
