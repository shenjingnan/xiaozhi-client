/**
 * 工具调用路由模块
 * 处理所有工具相关的 API 路由
 */

import type { RouteDefinition } from "@/routes/types.js";
import { createHandler } from "@/routes/types.js";

const callHandler = createHandler("mcpToolCallHandler");
const queryHandler = createHandler("mcpToolQueryHandler");
const mutationHandler = createHandler("mcpToolMutationHandler");
const mgmtHandler = createHandler("mcpToolManagementHandler");

/**
 * 工具调用路由定义
 */
export const toolsRoutes: RouteDefinition[] = [
  // 工具调用路由
  {
    method: "POST",
    path: "/api/tools/call",
    handler: callHandler((handler, c) => handler.callTool(c)),
  },
  // 工具查询路由
  {
    method: "GET",
    path: "/api/tools/list",
    handler: queryHandler((handler, c) => handler.listTools(c)),
  },
  {
    method: "GET",
    path: "/api/tools/custom",
    handler: queryHandler((handler, c) => handler.getCustomTools(c)),
  },
  {
    method: "POST",
    path: "/api/tools/mcp/list",
    handler: queryHandler((handler, c) => handler.listMCPTools(c)),
  },
  // 工具增删改路由
  {
    method: "POST",
    path: "/api/tools/custom",
    handler: mutationHandler((handler, c) => handler.addCustomTool(c)),
  },
  {
    method: "PUT",
    path: "/api/tools/custom/:toolName",
    handler: mutationHandler((handler, c) => handler.updateCustomTool(c)),
  },
  {
    method: "DELETE",
    path: "/api/tools/custom/:toolName",
    handler: mutationHandler((handler, c) => handler.removeCustomTool(c)),
  },
  // MCP 工具管理路由
  // 用于启用/禁用/查询 MCP 工具的状态
  {
    method: "POST",
    path: "/api/tools/mcp/manage",
    handler: mgmtHandler((handler, c) => handler.manageMCPTool(c)),
  },
];
