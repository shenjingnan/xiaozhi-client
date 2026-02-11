/**
 * 配置管理路由配置
 * 处理所有配置管理相关的 API 路由
 */

import type { RouteDefinition } from "@/routes/types.js";
import { createHandler } from "@/routes/types.js";

const h = createHandler("configApiHandler");

/**
 * 配置管理路由定义
 */
export const configRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/api/config",
    handler: h((handler, c) => handler.getConfig(c)),
  },
  {
    method: "PUT",
    path: "/api/config",
    handler: h((handler, c) => handler.updateConfig(c)),
  },
  {
    method: "GET",
    path: "/api/config/mcp-endpoint",
    handler: h((handler, c) => handler.getMcpEndpoint(c)),
  },
  {
    method: "GET",
    path: "/api/config/mcp-endpoints",
    handler: h((handler, c) => handler.getMcpEndpoints(c)),
  },
  {
    method: "GET",
    path: "/api/config/mcp-servers",
    handler: h((handler, c) => handler.getMcpServers(c)),
  },
  {
    method: "GET",
    path: "/api/config/connection",
    handler: h((handler, c) => handler.getConnectionConfig(c)),
  },
  {
    method: "POST",
    path: "/api/config/reload",
    handler: h((handler, c) => handler.reloadConfig(c)),
  },
  {
    method: "GET",
    path: "/api/config/path",
    handler: h((handler, c) => handler.getConfigPath(c)),
  },
  {
    method: "GET",
    path: "/api/config/exists",
    handler: h((handler, c) => handler.checkConfigExists(c)),
  },
];
