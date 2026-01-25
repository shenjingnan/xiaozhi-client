/**
 * MCP 协议路由模块
 * 处理 MCP 协议相关的 API 路由
 */

import type { RouteDefinition } from "../types.js";
import { createHandler } from "../types.js";

const h = createHandler("mcpRouteHandler");

/**
 * MCP 协议路由定义
 */
export const mcpRoutes: RouteDefinition[] = [
  {
    method: "POST",
    path: "/mcp",
    handler: h((handler, c) => handler.handlePost(c)),
  },
  {
    method: "GET",
    path: "/mcp",
    handler: h((handler, c) => handler.handleGet(c)),
  },
  {
    method: "DELETE",
    path: "/mcp",
    handler: h((handler, c) => handler.handleDelete(c)),
  },
];
