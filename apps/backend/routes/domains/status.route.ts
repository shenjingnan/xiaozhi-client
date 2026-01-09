/**
 * 状态查询路由模块
 * 处理所有状态相关的 API 路由
 */

import type { Context } from "hono";
import type { HandlerDependencies, RouteDefinition } from "../types.js";

/**
 * 状态查询路由定义（扁平化版本）
 */
export const statusRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/api/status",
    name: "status-get",
    handler: (c: Context) => {
      const { statusApiHandler } = c.get("dependencies") as HandlerDependencies;
      return statusApiHandler.getStatus(c);
    },
  },
  {
    method: "GET",
    path: "/api/status/client",
    name: "status-client-get",
    handler: (c: Context) => {
      const { statusApiHandler } = c.get("dependencies") as HandlerDependencies;
      return statusApiHandler.getClientStatus(c);
    },
  },
  {
    method: "PUT",
    path: "/api/status/client",
    name: "status-client-update",
    handler: (c: Context) => {
      const { statusApiHandler } = c.get("dependencies") as HandlerDependencies;
      return statusApiHandler.updateClientStatus(c);
    },
  },
  {
    method: "POST",
    path: "/api/status/reset",
    name: "status-reset",
    handler: (c: Context) => {
      const { statusApiHandler } = c.get("dependencies") as HandlerDependencies;
      return statusApiHandler.resetStatus(c);
    },
  },
  {
    method: "GET",
    path: "/api/status/mcp-servers",
    name: "status-mcp-servers-get",
    handler: (c: Context) => {
      const { statusApiHandler } = c.get("dependencies") as HandlerDependencies;
      return statusApiHandler.getActiveMCPServers(c);
    },
  },
  {
    method: "PUT",
    path: "/api/status/mcp-servers",
    name: "status-mcp-servers-set",
    handler: (c: Context) => {
      const { statusApiHandler } = c.get("dependencies") as HandlerDependencies;
      return statusApiHandler.setActiveMCPServers(c);
    },
  },
];
