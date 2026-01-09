/**
 * 工具调用路由模块
 * 处理所有工具相关的 API 路由
 */

import type { RouteDefinition } from "../types.js";
import { createHandler } from "../types.js";

const h = createHandler("toolApiHandler");

/**
 * 工具调用路由定义
 */
export const toolsRoutes: RouteDefinition[] = [
  {
    method: "POST",
    path: "/api/tools/call",
    name: "tools-call",
    handler: h((handler, c) => handler.callTool(c)),
  },
  {
    method: "GET",
    path: "/api/tools/list",
    name: "tools-list",
    handler: h((handler, c) => handler.listTools(c)),
  },
  {
    method: "GET",
    path: "/api/tools/custom",
    name: "custom-tools-get",
    handler: h((handler, c) => handler.getCustomTools(c)),
  },
  {
    method: "POST",
    path: "/api/tools/custom",
    name: "custom-tools-add",
    handler: h((handler, c) => handler.addCustomTool(c)),
  },
  {
    method: "PUT",
    path: "/api/tools/custom/:toolName",
    name: "custom-tools-update",
    handler: h((handler, c) => handler.updateCustomTool(c)),
  },
  {
    method: "DELETE",
    path: "/api/tools/custom/:toolName",
    name: "custom-tools-delete",
    handler: h((handler, c) => handler.removeCustomTool(c)),
  },
];
