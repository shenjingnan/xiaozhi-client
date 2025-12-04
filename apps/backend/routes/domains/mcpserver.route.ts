/**
 * MCP 服务器管理路由配置
 * 处理 MCP 服务器管理相关的 API 路由
 */

import type { Context } from "hono";
import type { HandlerDependencies, SimpleRouteConfig } from "../types.js";

export const mcpserverRoutes: SimpleRouteConfig = {
  name: "mcpserver",
  path: "/api/mcp-servers",
  description: "MCP 服务器管理相关 API",
  routes: [
    {
      method: "POST",
      path: "",
      handler: async (c: Context) => {
        const dependencies = c.get("dependencies") as HandlerDependencies;
        const handler = dependencies.mcpServerApiHandler;
        if (!handler) {
          return c.json(
            { error: "MCP Server API Handler not initialized" },
            503
          );
        }
        return await handler.addMCPServer(c);
      },
    },
    {
      method: "DELETE",
      path: "/:serverName",
      handler: async (c: Context) => {
        const dependencies = c.get("dependencies") as HandlerDependencies;
        const handler = dependencies.mcpServerApiHandler;
        if (!handler) {
          return c.json(
            { error: "MCP Server API Handler not initialized" },
            503
          );
        }
        return await handler.removeMCPServer(c);
      },
    },
    {
      method: "GET",
      path: "/:serverName/status",
      handler: async (c: Context) => {
        const dependencies = c.get("dependencies") as HandlerDependencies;
        const handler = dependencies.mcpServerApiHandler;
        if (!handler) {
          return c.json(
            { error: "MCP Server API Handler not initialized" },
            503
          );
        }
        return await handler.getMCPServerStatus(c);
      },
    },
    {
      method: "GET",
      path: "",
      handler: async (c: Context) => {
        const dependencies = c.get("dependencies") as HandlerDependencies;
        const handler = dependencies.mcpServerApiHandler;
        if (!handler) {
          return c.json(
            { error: "MCP Server API Handler not initialized" },
            503
          );
        }
        return await handler.listMCPServers(c);
      },
    },
  ],
};
