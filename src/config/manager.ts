/**
 * 配置管理器
 *
 * 核心配置管理模块，负责：
 * - 配置文件的读取和解析（支持 JSON 格式）
 * - 配置验证和类型检查
 * - 配置更新和持久化
 * - 配置变更事件通知
 * - 配置文件路径解析
 *
 * 此文件作为向后兼容的导出入口，实际实现已拆分为多个子模块：
 * - config-types.ts: 类型定义
 * - core-config-manager.ts: 核心配置文件管理
 * - mcp-service-config-manager.ts: MCP 服务配置管理
 * - custom-mcp-tool-manager.ts: 自定义 MCP 工具管理
 * - tool-stats-manager.ts: 工具统计管理
 * - config-manager-facade.ts: 统一外观类（向后兼容）
 *
 * @example
 * ```typescript
 * import { configManager } from '../config';
 *
 * // 获取配置
 * const config = configManager.getConfig();
 *
 * // 更新配置
 * configManager.updateConfig({ mcpEndpoint: 'wss://...' });
 *
 * // 监听配置更新事件
 * configManager.on('config:updated', (payload) => {
 *   console.log('配置已更新事件:', payload);
 *   const latestConfig = configManager.getConfig();
 *   console.log('最新配置对象:', latestConfig);
 * });
 * ```
 */

// 从外观类重新导出 ConfigManager 和 configManager 实例（向后兼容）
export {
  ConfigManager,
  configManager,
  // 类型重新导出
  AppConfig,
  ConnectionConfig,
  MCPServerConfig,
  MCPServerToolsConfig,
  MCPToolConfig,
  ModelScopeConfig,
  WebUIConfig,
  CustomMCPConfig,
  CustomMCPTool,
  HandlerConfig,
  ProxyHandlerConfig,
  HttpHandlerConfig,
  FunctionHandlerConfig,
  ScriptHandlerConfig,
  ChainHandlerConfig,
  MCPHandlerConfig,
  PlatformsConfig,
  PlatformConfig,
  CozePlatformConfig,
  TTSConfig,
  ASRConfig,
  LLMConfig,
  ToolCallLogConfig,
  LocalMCPServerConfig,
  SSEMCPServerConfig,
  HTTPMCPServerConfig,
  StreamableHTTPMCPServerConfig,
  WebServerInstance,
} from "./config-manager-facade.js";

// 导出子管理器（供高级用法）
export { CoreConfigManager, coreConfigManager } from "./core-config-manager.js";
export { MCPServiceConfigManager } from "./mcp-service-config-manager.js";
export { CustomMCPToolManager } from "./custom-mcp-tool-manager.js";
export { ToolStatsManager } from "./tool-stats-manager.js";

// 导出常量和工具函数
export {
  DEFAULT_CONNECTION_CONFIG,
  formatDateTime,
} from "./config-types.js";
