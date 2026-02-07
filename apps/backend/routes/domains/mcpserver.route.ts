/**
 * MCP 服务器管理路由配置
 * 处理 MCP 服务器管理相关的 API 路由
 */

import type { RouteDefinition } from "../types.js";
import { createHandler } from "../types.js";

/**
 * MCP 服务器处理器包装器
 * 使用 createHandler 工厂函数统一处理依赖注入
 * 当 mcpHandler 未初始化时返回中文错误信息
 */
const h = createHandler("mcpHandler", {
  errorCode: "MCP_HANDLER_NOT_AVAILABLE",
  errorMessage: "MCP 服务器处理器尚未初始化，请稍后再试",
});

export const mcpserverRoutes: RouteDefinition[] = [
  {
    method: "POST",
    path: "/api/mcp-servers",
    handler: h((handler, c) => handler.addMCPServer(c)),
  },
  {
    method: "DELETE",
    path: "/api/mcp-servers/:serverName",
    handler: h((handler, c) => handler.removeMCPServer(c)),
  },
  {
    method: "GET",
    path: "/api/mcp-servers/:serverName/status",
    handler: h((handler, c) => handler.getMCPServerStatus(c)),
  },
  {
    method: "GET",
    path: "/api/mcp-servers",
    handler: h((handler, c) => handler.listMCPServers(c)),
  },
];
