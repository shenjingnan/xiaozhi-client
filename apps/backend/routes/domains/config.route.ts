import type { RouteDefinition } from "../types.js";
import { createHandler } from "../types.js";

const h = createHandler("configApiHandler");

/**
 * 配置管理路由定义
 */
export const configRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/api/config",
    name: "config-get",
    handler: h((handler, c) => handler.getConfig(c)),
  },
  {
    method: "PUT",
    path: "/api/config",
    name: "config-update",
    handler: h((handler, c) => handler.updateConfig(c)),
  },
  {
    method: "GET",
    path: "/api/config/mcp-endpoint",
    name: "config-mcp-endpoint",
    handler: h((handler, c) => handler.getMcpEndpoint(c)),
  },
  {
    method: "GET",
    path: "/api/config/mcp-endpoints",
    name: "config-mcp-endpoints",
    handler: h((handler, c) => handler.getMcpEndpoints(c)),
  },
  {
    method: "GET",
    path: "/api/config/mcp-servers",
    name: "config-mcp-servers",
    handler: h((handler, c) => handler.getMcpServers(c)),
  },
  {
    method: "GET",
    path: "/api/config/connection",
    name: "config-connection",
    handler: h((handler, c) => handler.getConnectionConfig(c)),
  },
  {
    method: "POST",
    path: "/api/config/reload",
    name: "config-reload",
    handler: h((handler, c) => handler.reloadConfig(c)),
  },
  {
    method: "GET",
    path: "/api/config/path",
    name: "config-path",
    handler: h((handler, c) => handler.getConfigPath(c)),
  },
  {
    method: "GET",
    path: "/api/config/exists",
    name: "config-exists",
    handler: h((handler, c) => handler.checkConfigExists(c)),
  },
];
