/**
 * 工具调用路由模块
 * 处理所有工具相关的 API 路由
 */

import type { RouteDefinition } from "../types.js";
import { createHandler } from "../types.js";

// 使用新的专用处理器
const hCalling = createHandler("toolCallingHandler");
const hCustom = createHandler("customToolHandler");
const hMcpManagement = createHandler("mcpToolManagementHandler");

/**
 * 工具调用路由定义
 */
export const toolsRoutes: RouteDefinition[] = [
  // 工具调用相关路由
  {
    method: "POST",
    path: "/api/tools/call",
    handler: hCalling((handler, c) => handler.callTool(c)),
  },
  // 自定义工具管理路由
  {
    method: "GET",
    path: "/api/tools/custom",
    handler: hCustom((handler, c) => handler.getCustomTools(c)),
  },
  {
    method: "POST",
    path: "/api/tools/custom",
    handler: hCustom((handler, c) => handler.addCustomTool(c)),
  },
  {
    method: "PUT",
    path: "/api/tools/custom/:toolName",
    handler: hCustom((handler, c) => handler.updateCustomTool(c)),
  },
  {
    method: "DELETE",
    path: "/api/tools/custom/:toolName",
    handler: hCustom((handler, c) => handler.removeCustomTool(c)),
  },
  // MCP 工具管理路由
  {
    method: "GET",
    path: "/api/tools/list",
    handler: hMcpManagement((handler, c) => handler.listTools(c)),
  },
  {
    method: "POST",
    path: "/api/tools/mcp/manage",
    handler: hMcpManagement((handler, c) => handler.manageMCPTool(c)),
  },
  {
    method: "POST",
    path: "/api/tools/mcp/list",
    handler: hMcpManagement((handler, c) => handler.listMCPTools(c)),
  },
];
