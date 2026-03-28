/**
 * 路由域统一导出文件
 * 简化版本：直接导出所有路由配置对象
 * 替代原有的复杂的域索引文件结构
 */

// 导入所有可用的路由配置
export { configRoutes } from "./config.route.js";
export { cozeRoutes } from "./coze.route.js";
export { endpointRoutes } from "./endpoint.route.js";
export { esp32Routes } from "./esp32.route.js";
export { mcpRoutes } from "./mcp.route.js";
export { mcpserverRoutes } from "./mcpserver.route.js";
export { miscRoutes } from "./misc.route.js";
export { servicesRoutes } from "./services.route.js";
export { staticRoutes } from "./static.route.js";
export { statusRoutes } from "./status.route.js";
export { toolLogsRoutes } from "./tool-logs.route.js";
export { toolsRoutes } from "./tools.route.js";
export { ttsRoutes } from "./tts.route.js";
export { updateRoutes } from "./update.route.js";
export { versionRoutes } from "./version.route.js";

/**
 * 路由域名列表
 */
export const routeNames = [
  "config",
  "status",
  "tools",
  "mcp",
  "version",
  "services",
  "update",
  "static",
  "coze",
  "tool-logs",
  "mcpserver",
  "endpoint",
  "misc",
  "tts",
  "esp32",
] as const;

/**
 * 路由域名类型
 */
export type RouteName = (typeof routeNames)[number];
