/**
 * 状态查询路由模块
 * 处理所有状态相关的 API 路由
 */

import type { RouteDefinition } from "@/routes/types.js";
import { createHandler } from "@/routes/types.js";

const h = createHandler("statusApiHandler");

/**
 * 状态查询路由定义
 */
export const statusRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/api/status",
    handler: h((handler, c) => handler.getStatus(c)),
  },
  {
    method: "GET",
    path: "/api/status/client",
    handler: h((handler, c) => handler.getClientStatus(c)),
  },
  {
    method: "PUT",
    path: "/api/status/client",
    handler: h((handler, c) => handler.updateClientStatus(c)),
  },
  {
    method: "POST",
    path: "/api/status/reset",
    handler: h((handler, c) => handler.resetStatus(c)),
  },
  {
    method: "GET",
    path: "/api/status/mcp-servers",
    handler: h((handler, c) => handler.getActiveMCPServers(c)),
  },
  {
    method: "PUT",
    path: "/api/status/mcp-servers",
    handler: h((handler, c) => handler.setActiveMCPServers(c)),
  },
];
