/**
 * 工具调用路由模块
 * 处理所有工具相关的 API 路由
 */

import type { Context } from "hono";
import type { HandlerDependencies, RouteDefinition } from "../types.js";

/**
 * 工具调用路由定义（扁平化版本）
 */
export const toolsRoutes: RouteDefinition[] = [
  {
    method: "POST",
    path: "/api/tools/call",
    name: "tools-call",
    handler: (c: Context) => {
      const { toolApiHandler } = c.get("dependencies") as HandlerDependencies;
      return toolApiHandler.callTool(c);
    },
  },
  {
    method: "GET",
    path: "/api/tools/list",
    name: "tools-list",
    handler: (c: Context) => {
      const { toolApiHandler } = c.get("dependencies") as HandlerDependencies;
      return toolApiHandler.listTools(c);
    },
  },
  {
    method: "GET",
    path: "/api/tools/custom",
    name: "custom-tools-get",
    handler: (c: Context) => {
      const { toolApiHandler } = c.get("dependencies") as HandlerDependencies;
      return toolApiHandler.getCustomTools(c);
    },
  },
  {
    method: "POST",
    path: "/api/tools/custom",
    name: "custom-tools-add",
    handler: (c: Context) => {
      const { toolApiHandler } = c.get("dependencies") as HandlerDependencies;
      return toolApiHandler.addCustomTool(c);
    },
  },
  {
    method: "PUT",
    path: "/api/tools/custom/:toolName",
    name: "custom-tools-update",
    handler: (c: Context) => {
      const { toolApiHandler } = c.get("dependencies") as HandlerDependencies;
      return toolApiHandler.updateCustomTool(c);
    },
  },
  {
    method: "DELETE",
    path: "/api/tools/custom/:toolName",
    name: "custom-tools-delete",
    handler: (c: Context) => {
      const { toolApiHandler } = c.get("dependencies") as HandlerDependencies;
      return toolApiHandler.removeCustomTool(c);
    },
  },
];
