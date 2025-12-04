/**
 * 工具调用路由模块
 * 处理所有工具相关的 API 路由
 * 简化版本：移除继承，直接导出路由配置
 */

import type { Context } from "hono";
import type { HandlerDependencies, SimpleRouteConfig } from "../types.js";

/**
 * 工具调用路由配置
 * 从原有的 ToolsRoutes 类迁移而来，保持功能完全一致
 */
export const toolsRoutes: SimpleRouteConfig = {
  name: "tools",
  path: "/api/tools",
  description: "工具调用相关 API",
  routes: [
    {
      method: "POST",
      path: "/call",
      handler: (c: Context) => {
        const { toolApiHandler } = c.get("dependencies") as HandlerDependencies;
        return toolApiHandler.callTool(c);
      },
    },
    {
      method: "GET",
      path: "/list",
      handler: (c: Context) => {
        const { toolApiHandler } = c.get("dependencies") as HandlerDependencies;
        return toolApiHandler.listTools(c);
      },
    },
    {
      method: "GET",
      path: "/custom",
      handler: (c: Context) => {
        const { toolApiHandler } = c.get("dependencies") as HandlerDependencies;
        return toolApiHandler.getCustomTools(c);
      },
    },
    {
      method: "POST",
      path: "/custom",
      handler: (c: Context) => {
        const { toolApiHandler } = c.get("dependencies") as HandlerDependencies;
        return toolApiHandler.addCustomTool(c);
      },
    },
    {
      method: "PUT",
      path: "/custom/:toolName",
      handler: (c: Context) => {
        const { toolApiHandler } = c.get("dependencies") as HandlerDependencies;
        return toolApiHandler.updateCustomTool(c);
      },
    },
    {
      method: "DELETE",
      path: "/custom/:toolName",
      handler: (c: Context) => {
        const { toolApiHandler } = c.get("dependencies") as HandlerDependencies;
        return toolApiHandler.removeCustomTool(c);
      },
    },
  ],
};
