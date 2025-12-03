/**
 * 工具调用路由模块
 * 处理所有工具相关的 API 路由
 */

import { BaseRoute } from "../../BaseRoute.js";
import type { RouteDomainConfig } from "../../types.js";

/**
 * 工具调用路由类
 * 负责注册工具相关的所有 API 路由
 */
export class ToolsRoutes extends BaseRoute {
  /**
   * 获取工具路由域配置
   * @returns 路由域配置
   */
  getRouteConfig(): RouteDomainConfig {
    const handler = this.getRequiredDependency("toolApiHandler");

    return {
      name: "tools",
      description: "工具调用相关 API",
      path: "/api/tools",
      routes: [
        {
          method: "POST",
          path: "/call",
          handler: (c) => handler.callTool(c),
        },
        {
          method: "GET",
          path: "/list",
          handler: (c) => handler.listTools(c),
        },
        {
          method: "GET",
          path: "/custom",
          handler: (c) => handler.getCustomTools(c),
        },
        {
          method: "POST",
          path: "/custom",
          handler: (c) => handler.addCustomTool(c),
        },
        {
          method: "PUT",
          path: "/custom/:toolName",
          handler: (c) => handler.updateCustomTool(c),
        },
        {
          method: "DELETE",
          path: "/custom/:toolName",
          handler: (c) => handler.removeCustomTool(c),
        },
      ],
    };
  }
}
