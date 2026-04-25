/**
 * @/config
 *
 * 小智客户端配置管理库
 *
 * 此库提供了配置文件解析、验证和管理的完整功能，包括：
 * - ConfigManager: 配置管理器，负责配置文件的加载、保存和验证
 * - ConfigResolver: 配置解析器，按优先级查找配置文件
 * - ConfigInitializer: 配置初始化器，负责创建默认配置
 * - 配置适配与转换工具: 提供旧配置向新格式迁移、规范化（例如 normalizeServiceConfig 等）
 * - 配置格式工具: 提供标准 JSON 格式的读写支持
 *
 * @example
 * ```typescript
 * import { configManager } from '@/config';
 *
 * // 获取配置
 * const config = configManager.getConfig();
 *
 * // 更新 MCP 端点配置
 * configManager.updateMcpEndpoint('wss://api.example.com/mcp');
 * ```
 */

// =========================
// 运行时导出
// =========================

export { configManager, ConfigManager } from "./manager.js";
export {
  getConfigTypeDescription,
  normalizeServiceConfig,
  normalizeServiceConfigBatch,
  isModelScopeURL,
} from "./adapter.js";
export { ConfigResolver } from "./resolver.js";
export { ConfigInitializer } from "./initializer.js";

// CustomMCP 工具处理器配置类型（定义在 manager.ts 中，不在 types/config 中）
export type {
  AppConfig,
  ChainHandlerConfig,
  CustomMCPConfig,
  CustomMCPTool,
  FunctionHandlerConfig,
  HandlerConfig,
  HttpHandlerConfig,
  MCPHandlerConfig,
  ProxyHandlerConfig,
  ScriptHandlerConfig,
  WebServerInstance,
} from "./manager.js";

// =========================
// 类型导出：从唯一权威源 re-export
// 确保 @/config 与 @/types 导出的类型完全一致
// =========================

export type {
  ASRConfig,
  ConnectionConfig,
  CozePlatformConfig,
  HTTPMCPServerConfig,
  LLMConfig,
  LocalMCPServerConfig,
  MCPToolConfig,
  MCPServerConfig,
  MCPServerToolsConfig,
  ModelScopeConfig,
  PlatformConfig,
  PlatformsConfig,
  SSEMCPServerConfig,
  StreamableHTTPMCPServerConfig,
  ToolCallLogConfig,
  TTSConfig,
  WebUIConfig,
} from "../types";
