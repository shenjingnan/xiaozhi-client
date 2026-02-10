/**
 * 配置管理包入口文件
 * 导出所有公共 API
 */

// 导出原有模块
export * from "./manager.js";
export * from "./adapter.js";
export * from "./resolver.js";
export * from "./initializer.js";

// 导出类型定义
export type * from "./types.js";

// 导出事件系统
export { ConfigEvents, configEvents } from "./events.js";

// 导出存储系统
export { ConfigStorage, configStorage } from "./storage.js";

// 导出验证器
export { ConfigValidator, configValidator } from "./validator.js";

// 导出端点管理
export { ConfigEndpoints, configEndpoints } from "./endpoints.js";

// 导出服务器管理
export { ConfigServers, configServers } from "./servers.js";

// 导出工具管理
export { ConfigTools, configTools } from "./tools.js";

// 导出连接管理
export { ConfigConnection, configConnection } from "./connection.js";

// 导出平台管理
export { ConfigPlatforms, configPlatforms } from "./platforms.js";

// 导出统计管理
export { ConfigStats, configStats } from "./stats.js";
