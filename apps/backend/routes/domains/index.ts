/**
 * 路由域统一导出文件
 * 简化版本：直接导出所有路由配置对象
 * 替代原有的复杂的域索引文件结构
 */

// 导入所有可用的路由配置
export { configRoutes } from "./config.route.js";
export { statusRoutes } from "./status.route.js";
export { toolsRoutes } from "./tools.route.js";
export { mcpRoutes } from "./mcp.route.js";
export { versionRoutes } from "./version.route.js";
export { servicesRoutes } from "./services.route.js";
export { updateRoutes } from "./update.route.js";
export { staticRoutes } from "./static.route.js";
export { cozeRoutes } from "./coze.route.js";
export { toollogsRoutes } from "./toollogs.route.js";
export { mcpserverRoutes } from "./mcpserver.route.js";
export { endpointRoutes } from "./endpoint.route.js";

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
  "toollogs",
  "mcpserver",
  "endpoint",
] as const;

/**
 * 路由域名类型
 */
export type RouteName = (typeof routeNames)[number];
