/**
 * @xiaozhi-client/config
 *
 * 小智客户端配置管理库
 *
 * 此库提供了配置文件解析、验证和管理的完整功能，包括：
 * - ConfigManager: 配置管理器，负责配置文件的加载、保存和验证
 * - ConfigResolver: 配置解析器，按优先级查找配置文件
 * - ConfigInitializer: 配置初始化器，负责创建默认配置
 * - 配置适配与转换工具: 提供旧配置向新格式迁移、规范化（例如 normalizeServiceConfig 等）
 * - JSON5 读写工具: 提供 JSON5 格式的读写支持
 *
 * @example
 * ```typescript
 * import { configManager } from '@xiaozhi-client/config';
 *
 * // 获取配置
 * const config = configManager.getConfig();
 *
 * // 更新 MCP 端点配置
 * configManager.updateMcpEndpoint('wss://api.example.com/mcp');
 * ```
 */

// =========================
// 导出
// =========================

// 主要导出（manager.ts 已经重新导出所有类型）
export * from "./manager.js";

// 配置适配与转换工具
export * from "./adapter.js";

// 配置解析器
export * from "./resolver.js";

// 配置初始化器
export * from "./initializer.js";

// 内部模块导出（高级用法）
export { ConfigIO } from "./ConfigIO.js";
export { ConfigValidator } from "./ConfigValidator.js";
export { ConfigEventBus } from "./ConfigEventBus.js";
export { MCPConfigManager } from "./MCPConfigManager.js";
export { CustomMCPToolsManager } from "./CustomMCPToolsManager.js";
export { ToolUsageStats } from "./ToolUsageStats.js";
export { ConnectionConfigManager } from "./ConnectionConfigManager.js";
