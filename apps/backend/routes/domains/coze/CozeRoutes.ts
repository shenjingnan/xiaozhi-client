/**
 * 扣子 API 路由模块
 * 处理所有扣子相关的 API 路由
 */

import { BaseRoute } from "../../BaseRoute.js";
import type { RouteDomainConfig } from "../../types.js";

/**
 * 扣子 API 路由类
 * 负责注册扣子相关的所有 API 路由
 */
export class CozeRoutes extends BaseRoute {
  /**
   * 获取扣子路由域配置
   * @returns 路由域配置
   */
  getRouteConfig(): RouteDomainConfig {
    const CozeHandler = this.getRequiredDependency("cozeApiHandler");

    return {
      name: "coze",
      description: "扣子 API 相关路由",
      path: "/api/coze",
      routes: [
        {
          method: "GET",
          path: "/workspaces",
          handler: (c) => CozeHandler.getWorkspaces(c),
        },
        {
          method: "GET",
          path: "/workflows",
          handler: (c) => CozeHandler.getWorkflows(c),
        },
        {
          method: "POST",
          path: "/cache/clear",
          handler: (c) => CozeHandler.clearCache(c),
        },
        {
          method: "GET",
          path: "/cache/stats",
          handler: (c) => CozeHandler.getCacheStats(c),
        },
      ],
    };
  }
}
