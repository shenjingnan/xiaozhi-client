/**
 * MCP 协议路由模块
 * 处理 MCP 协议相关的 API 路由
 */

import { BaseRoute } from "../../BaseRoute.js";
import type { RouteDomainConfig } from "../../types.js";

/**
 * MCP 协议路由类
 * 负责注册 MCP 协议相关的所有 API 路由
 */
export class MCPRoutes extends BaseRoute {
  /**
   * 获取 MCP 路由域配置
   * @returns 路由域配置
   */
  getRouteConfig(): RouteDomainConfig {
    const handler = this.getRequiredDependency("mcpRouteHandler");

    return {
      name: "mcp",
      description: "MCP 协议相关 API",
      path: "/mcp",
      routes: [
        {
          method: "POST",
          path: "",
          handler: (c) => handler.handlePost(c),
        },
        {
          method: "GET",
          path: "",
          handler: (c) => handler.handleGet(c),
        },
      ],
    };
  }
}
