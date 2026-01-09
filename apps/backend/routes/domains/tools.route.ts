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
    handler: h((handler, c) => handler.callTool(c)),
  },
  {
    method: "GET",
    path: "/api/tools/list",
    handler: h((handler, c) => handler.listTools(c)),
  },
  {
    method: "GET",
    path: "/api/tools/custom",
    handler: h((handler, c) => handler.getCustomTools(c)),
  },
  {
    method: "POST",
    path: "/api/tools/custom",
    handler: h((handler, c) => handler.addCustomTool(c)),
  },
  {
    method: "PUT",
    path: "/api/tools/custom/:toolName",
    handler: h((handler, c) => handler.updateCustomTool(c)),
  },
  {
    method: "DELETE",
    path: "/api/tools/custom/:toolName",
    handler: h((handler, c) => handler.removeCustomTool(c)),
  },
  /**
   * MCP 工具管理路由
   * 用于启用/禁用/查询 MCP 工具的状态
   */
  {
    method: "POST",
    path: "/api/tools/mcp/manage",
    handler: h((handler, c) => handler.manageMCPTool(c)),
  },
  {
    method: "POST",
    path: "/api/tools/mcp/list",
    handler: h((handler, c) => handler.listMCPTools(c)),
  },
];
