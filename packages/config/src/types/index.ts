/**
 * 类型定义统一导出
 *
 * 从各个类型文件中统一导出所有类型定义
 */

// MCP 相关类型
export type {
  LocalMCPServerConfig,
  SSEMCPServerConfig,
  HTTPMCPServerConfig,
  StreamableHTTPMCPServerConfig,
  MCPServerConfig,
  MCPToolConfig,
  MCPServerToolsConfig,
} from "./mcp.types.js";

// 连接配置类型
export type { ConnectionConfig } from "./connection.types.js";

// Handler 配置类型
export type {
  ProxyHandlerConfig,
  HttpHandlerConfig,
  FunctionHandlerConfig,
  ScriptHandlerConfig,
  ChainHandlerConfig,
  MCPHandlerConfig,
  HandlerConfig,
} from "./handler.types.js";

// CustomMCP 类型
export type { CustomMCPTool, CustomMCPConfig } from "./custom-mcp.types.js";

// 平台配置类型
export type {
  ModelScopeConfig,
  WebUIConfig,
  TTSConfig,
  ASRConfig,
  LLMConfig,
  ToolCallLogConfig,
  PlatformConfig,
  PlatformsConfig,
  CozePlatformConfig,
} from "./platform.types.js";

// 核心配置类型
export type { AppConfig, WebServerInstance } from "./app.types.js";
