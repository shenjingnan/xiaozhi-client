/**
 * MCP 协议路由模块
 * 处理 MCP 协议相关的 API 路由
 */

import type { Context } from "hono";
import type { HandlerDependencies, RouteDefinition } from "../types.js";

/**
 * MCP 协议路由定义（扁平化版本）
 */
export const mcpRoutes: RouteDefinition[] = [
  {
    method: "POST",
    path: "/mcp",
    name: "mcp-post",
    handler: (c: Context) => {
      const { mcpRouteHandler } = c.get("dependencies") as HandlerDependencies;
      return mcpRouteHandler.handlePost(c);
    },
  },
  {
    method: "GET",
    path: "/mcp",
    name: "mcp-get",
    handler: (c: Context) => {
      const { mcpRouteHandler } = c.get("dependencies") as HandlerDependencies;
      return mcpRouteHandler.handleGet(c);
    },
  },
];
