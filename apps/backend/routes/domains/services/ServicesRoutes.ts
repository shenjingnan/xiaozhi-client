/**
 * 服务管理路由模块
 * 处理所有服务管理相关的 API 路由
 */

import { BaseRoute } from "../../BaseRoute.js";
import type { RouteDomainConfig } from "../../types.js";

/**
 * 服务管理路由类
 * 负责注册服务管理相关的所有 API 路由
 */
export class ServicesRoutes extends BaseRoute {
  /**
   * 获取服务管理路由域配置
   * @returns 路由域配置
   */
  getRouteConfig(): RouteDomainConfig {
    const handler = this.getRequiredDependency("serviceApiHandler");

    return {
      name: "services",
      description: "服务管理相关 API",
      path: "/api/services",
      routes: [
        {
          method: "POST",
          path: "/restart",
          handler: (c) => handler.restartService(c),
        },
        {
          method: "POST",
          path: "/stop",
          handler: (c) => handler.stopService(c),
        },
        {
          method: "POST",
          path: "/start",
          handler: (c) => handler.startService(c),
        },
        {
          method: "GET",
          path: "/status",
          handler: (c) => handler.getServiceStatus(c),
        },
        {
          method: "GET",
          path: "/health",
          handler: (c) => handler.getServiceHealth(c),
        },
      ],
    };
  }
}
