/**
 * 更新管理路由模块
 * 处理更新相关的 API 路由
 */

import { BaseRoute } from "../../BaseRoute.js";
import type { RouteDomainConfig } from "../../types.js";

/**
 * 更新管理路由类
 * 负责注册更新相关的所有 API 路由
 */
export class UpdateRoutes extends BaseRoute {
  /**
   * 获取更新路由域配置
   * @returns 路由域配置
   */
  getRouteConfig(): RouteDomainConfig {
    const handler = this.getRequiredDependency("updateApiHandler");

    return {
      name: "update",
      description: "更新管理相关 API",
      path: "/api",
      routes: [
        {
          method: "POST",
          path: "/update",
          handler: (c) => handler.performUpdate(c),
        },
      ],
    };
  }
}
