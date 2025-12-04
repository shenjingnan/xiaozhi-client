/**
 * MCP 服务器管理路由配置
 * 处理 MCP 服务器管理相关的 API 路由
 */

import type { Context } from "hono";
import type { SimpleRouteConfig } from "../types.js";

export const mcpserverRoutes: SimpleRouteConfig = {
  name: "mcpserver",
  path: "/api/mcp-servers",
  description: "MCP 服务器管理相关 API",
  routes: [
    {
      method: "POST",
      path: "",
      handler: (c: Context) => {
        const handler = c.get("mcpServerApiHandler");
        return handler.addMCPServer(c);
      },
    },
    {
      method: "DELETE",
      path: "/:serverName",
      handler: (c: Context) => {
        const handler = c.get("mcpServerApiHandler");
        return handler.removeMCPServer(c);
      },
    },
    {
      method: "GET",
      path: "/:serverName/status",
      handler: (c: Context) => {
        const handler = c.get("mcpServerApiHandler");
        return handler.getMCPServerStatus(c);
      },
    },
    {
      method: "GET",
      path: "",
      handler: (c: Context) => {
        const handler = c.get("mcpServerApiHandler");
        return handler.listMCPServers(c);
      },
    },
  ],
};
