/**
 * MCP 协议路由模块
 * 处理 MCP 协议相关的 API 路由（仅 POST 模式）
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
];
