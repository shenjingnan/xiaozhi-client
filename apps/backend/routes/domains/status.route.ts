/**
 * 状态查询路由模块
 * 处理所有状态相关的 API 路由
 */

import type { RouteDefinition } from "../types.js";
import { createHandler } from "../types.js";

const h = createHandler("statusApiHandler");

/**
 * 状态查询路由定义
 */
export const statusRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/api/status",
    name: "status-get",
    handler: h((handler, c) => handler.getStatus(c)),
  },
  {
    method: "GET",
    path: "/api/status/client",
    name: "status-client-get",
    handler: h((handler, c) => handler.getClientStatus(c)),
  },
  {
    method: "PUT",
    path: "/api/status/client",
    name: "status-client-update",
    handler: h((handler, c) => handler.updateClientStatus(c)),
  },
  {
    method: "POST",
    path: "/api/status/reset",
    name: "status-reset",
    handler: h((handler, c) => handler.resetStatus(c)),
  },
  {
    method: "GET",
    path: "/api/status/mcp-servers",
    name: "status-mcp-servers-get",
    handler: h((handler, c) => handler.getActiveMCPServers(c)),
  },
  {
    method: "PUT",
    path: "/api/status/mcp-servers",
    name: "status-mcp-servers-set",
    handler: h((handler, c) => handler.setActiveMCPServers(c)),
  },
];
