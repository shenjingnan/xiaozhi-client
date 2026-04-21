/**
 * @/config
 *
 * 小智客户端配置管理库
 *
 * 此库提供了配置文件解析、验证和管理的完整功能，包括：
 * - ConfigManager: 配置管理器外观类，负责配置文件的加载、保存和验证（向后兼容）
 * - CoreConfigManager: 核心配置管理器，负责配置文件的基本操作
 * - MCPServiceConfigManager: MCP 服务配置管理器
 * - CustomMCPToolManager: 自定义 MCP 工具配置管理器
 * - ToolStatsManager: 工具使用统计管理器
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
 *
 * // 高级用法：直接使用子管理器
 * import { CoreConfigManager, MCPServiceConfigManager } from '@/config';
 * const coreConfig = CoreConfigManager.getInstance();
 * const mcpService = new MCPServiceConfigManager(coreConfig);
 * ```
 */

// =========================
// 导出
// =========================

// 主入口（向后兼容）
export * from "./manager.js";

// 子模块导出（高级用法）- 使用选择性导出避免重复
export {
  // 类型定义
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
  WebServerInstance,
  ConfigUpdateEventType,
  ConfigUpdateEventData,
  // 常量和函数
  DEFAULT_CONNECTION_CONFIG,
  formatDateTime,
} from "./config-types.js";

// 子管理器导出
export {
  CoreConfigManager,
  coreConfigManager,
} from "./core-config-manager.js";
export { MCPServiceConfigManager } from "./mcp-service-config-manager.js";
export { CustomMCPToolManager } from "./custom-mcp-tool-manager.js";
export { ToolStatsManager } from "./tool-stats-manager.js";
export {
  ConfigManager as ConfigManagerFacade,
  configManager as configManagerFacade,
} from "./config-manager-facade.js";

// 其他工具
export * from "./adapter.js";
export * from "./resolver.js";
export * from "./initializer.js";
