/**
 * 管理器模块导出
 *
 * 导出所有管理器类和相关类型
 */

// 核心存储
export { ConfigStore } from "./ConfigStore.js";

// 专用管理器
export { MCPConfigManager } from "./MCPConfigManager.js";
export { ToolConfigManager } from "./ToolConfigManager.js";
export { ConnectionConfigManager } from "./ConnectionConfigManager.js";
export { ModelScopeConfigManager } from "./ModelScopeConfigManager.js";
export { CustomMCPConfigManager } from "./CustomMCPConfigManager.js";
export { PlatformConfigManager } from "./PlatformConfigManager.js";
export { MediaConfigManager } from "./MediaConfigManager.js";
export { WebUIConfigManager } from "./WebUIConfigManager.js";

// 主要的 ConfigManager（外观模式）
export { ConfigManager, configManager } from "./ConfigManager.js";

// 类型
export * from "./types.js";
