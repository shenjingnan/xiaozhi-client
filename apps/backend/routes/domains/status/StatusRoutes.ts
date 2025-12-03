/**
 * 状态查询路由模块
 * 处理所有状态相关的 API 路由
 */

import { BaseRoute } from "../../BaseRoute.js";
import type { RouteDomainConfig } from "../../types.js";

/**
 * 状态查询路由类
 * 负责注册状态相关的所有 API 路由
 */
export class StatusRoutes extends BaseRoute {
  /**
   * 获取状态路由域配置
   * @returns 路由域配置
   */
  getRouteConfig(): RouteDomainConfig {
    const handler = this.getRequiredDependency("statusApiHandler");

    return {
      name: "status",
      description: "状态查询相关 API",
      path: "/api/status",
      routes: [
        {
          method: "GET",
          path: "",
          handler: (c) => handler.getStatus(c),
        },
        {
          method: "GET",
          path: "/client",
          handler: (c) => handler.getClientStatus(c),
        },
        {
          method: "GET",
          path: "/restart",
          handler: (c) => handler.getRestartStatus(c),
        },
        {
          method: "GET",
          path: "/connected",
          handler: (c) => handler.checkClientConnected(c),
        },
        {
          method: "GET",
          path: "/heartbeat",
          handler: (c) => handler.getLastHeartbeat(c),
        },
        {
          method: "GET",
          path: "/mcp-servers",
          handler: (c) => handler.getActiveMCPServers(c),
        },
        {
          method: "PUT",
          path: "/client",
          handler: (c) => handler.updateClientStatus(c),
        },
        {
          method: "PUT",
          path: "/mcp-servers",
          handler: (c) => handler.setActiveMCPServers(c),
        },
        {
          method: "POST",
          path: "/reset",
          handler: (c) => handler.resetStatus(c),
        },
      ],
    };
  }
}
