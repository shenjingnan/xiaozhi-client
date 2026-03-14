/**
 * 配置管理器（兼容层）
 *
 * 此文件是向后兼容层，重新导出重构后的 ConfigManager。
 * 实际实现已迁移到 `./managers/ConfigManager.ts`
 *
 * 重构说明：
 * - 原始 ConfigManager 类（2406 行，102 个方法）已拆分为多个专门的管理器
 * - ConfigStore: 核心配置 I/O
 * - MCPConfigManager: MCP 端点和服务器管理
 * - ToolConfigManager: 工具配置和统计管理
 * - ConnectionConfigManager: 连接配置管理
 * - ModelScopeConfigManager: ModelScope 配置管理
 * - CustomMCPConfigManager: CustomMCP 工具管理
 * - PlatformConfigManager: 平台配置管理
 * - MediaConfigManager: TTS/ASR/LLM 配置管理
 * - WebUIConfigManager: WebUI 和工具调用日志配置管理
 *
 * 所有导出的类型和类保持相同的 API，确保完全向后兼容
 */

// =========================
// 重新导出所有类型
// =========================
export type {
  AppConfig,
  MCPServerConfig,
  LocalMCPServerConfig,
  SSEMCPServerConfig,
  HTTPMCPServerConfig,
  StreamableHTTPMCPServerConfig,
  MCPToolConfig,
  MCPServerToolsConfig,
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
  CustomMCPTool,
  HandlerConfig,
  ProxyHandlerConfig,
  HttpHandlerConfig,
  FunctionHandlerConfig,
  ScriptHandlerConfig,
  ChainHandlerConfig,
  MCPHandlerConfig,
  WebServerInstance,
} from "./types.js";

// =========================
// 重新导出 ConfigManager
// =========================
export { ConfigManager, configManager } from "./managers/ConfigManager.js";
