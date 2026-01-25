/**
 * MCP 服务器管理路由配置
 * 处理 MCP 服务器管理相关的 API 路由
 */

import type { Context } from "hono";
import type { HandlerDependencies, RouteDefinition } from "../types.js";

/**
 * MCP 服务器处理器包装函数
 * 统一处理 MCP Server API Handler 的初始化检查
 */
const withMCPServerHandler = async (
  c: Context,
  handlerFn: (
    handler: NonNullable<HandlerDependencies["mcpHandler"]>
  ) => Promise<Response>
): Promise<Response> => {
  const dependencies = c.get("dependencies") as HandlerDependencies;
  const handler = dependencies.mcpHandler;

  if (!handler) {
    return c.json({ error: "MCP Server API Handler not initialized" }, 503);
  }

  return await handlerFn(handler);
};

export const mcpserverRoutes: RouteDefinition[] = [
  {
    method: "POST",
    path: "/api/mcp-servers",
    handler: (c: Context) => withMCPServerHandler(c, (h) => h.addMCPServer(c)),
  },
  {
    method: "DELETE",
    path: "/api/mcp-servers/:serverName",
    handler: (c: Context) =>
      withMCPServerHandler(c, (h) => h.removeMCPServer(c)),
  },
  {
    method: "GET",
    path: "/api/mcp-servers/:serverName/status",
    handler: (c: Context) =>
      withMCPServerHandler(c, (h) => h.getMCPServerStatus(c)),
  },
  {
    method: "GET",
    path: "/api/mcp-servers",
    handler: (c: Context) =>
      withMCPServerHandler(c, (h) => h.listMCPServers(c)),
  },
];
