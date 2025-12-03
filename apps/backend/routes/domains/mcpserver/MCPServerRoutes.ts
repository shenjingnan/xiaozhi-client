/**
 * MCP 服务器管理路由模块
 * 处理 MCP 服务器管理相关的 API 路由
 */

import { BaseRoute } from "../../BaseRoute.js";
import type { RouteDomainConfig } from "../../types.js";

/**
 * MCP 服务器管理路由类
 * 负责注册 MCP 服务器管理相关的所有 API 路由
 */
export class MCPServerRoutes extends BaseRoute {
  /**
   * 获取 MCP 服务器管理路由域配置
   * @returns 路由域配置
   */
  getRouteConfig(): RouteDomainConfig {
    const handler = this.getRequiredDependency("mcpServerApiHandler");

    return {
      name: "mcpserver",
      description: "MCP 服务器管理相关 API",
      path: "/api/mcp-servers",
      routes: [
        {
          method: "POST",
          path: "",
          handler: (c) => handler.addMCPServer(c),
        },
        {
          method: "DELETE",
          path: "/:serverName",
          handler: (c) => handler.removeMCPServer(c),
        },
        {
          method: "GET",
          path: "/:serverName/status",
          handler: (c) => handler.getMCPServerStatus(c),
        },
        {
          method: "GET",
          path: "",
          handler: (c) => handler.listMCPServers(c),
        },
      ],
    };
  }
}
