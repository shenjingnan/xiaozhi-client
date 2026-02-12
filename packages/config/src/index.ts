/**
 * @xiaozhi-client/config
 *
 * 小智客户端配置管理库
 *
 * 此库提供了配置文件解析、验证和管理的完整功能，包括：
 * - ConfigManager: 配置管理器，负责配置文件的加载、保存和验证
 * - ConfigResolver: 配置解析器，按优先级查找配置文件
 * - ConfigInitializer: 配置初始化器，负责创建默认配置
 * - ConfigAdapter: 配置适配器，处理旧格式到新格式的转换
 * - Json5Writer: JSON5 写入器，支持注释保留
 *
 * @example
 * ```typescript
 * import { configManager } from '@xiaozhi-client/config';
 *
 * // 获取配置
 * const config = configManager.getConfig();
 *
 * // 更新配置
 * configManager.set('mcpEndpoint', 'wss://api.example.com/mcp');
 * ```
 */

// =========================
// 导出
// =========================

export * from "./manager.js";
export * from "./adapter.js";
export * from "./resolver.js";
export * from "./initializer.js";
