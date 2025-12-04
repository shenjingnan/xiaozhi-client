/**
 * MCP 协议路由模块
 * 处理 MCP 协议相关的 API 路由
 * 简化版本：移除继承，直接导出路由配置
 */

import type { Context } from "hono";
import type { SimpleRouteConfig } from "../types.js";

/**
 * MCP 协议路由配置
 * 从原有的 MCPRoutes 类迁移而来，保持功能完全一致
 */
export const mcpRoutes: SimpleRouteConfig = {
  name: "mcp",
  path: "/mcp",
  description: "MCP 协议相关 API",
  routes: [
    {
      method: "POST",
      path: "",
      handler: (c: Context) => {
        const { mcpRouteHandler } = c.get("dependencies") as any;
        return mcpRouteHandler.handlePost(c);
      },
    },
    {
      method: "GET",
      path: "",
      handler: (c: Context) => {
        const { mcpRouteHandler } = c.get("dependencies") as any;
        return mcpRouteHandler.handleGet(c);
      },
    },
  ],
};