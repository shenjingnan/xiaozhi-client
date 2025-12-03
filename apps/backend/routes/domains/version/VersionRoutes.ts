/**
 * 版本信息路由模块
 * 处理所有版本相关的 API 路由
 */

import { BaseRoute } from "../../BaseRoute.js";
import type { RouteDomainConfig } from "../../types.js";

/**
 * 版本信息路由类
 * 负责注册版本相关的所有 API 路由
 */
export class VersionRoutes extends BaseRoute {
  /**
   * 获取版本路由域配置
   * @returns 路由域配置
   */
  getRouteConfig(): RouteDomainConfig {
    const handler = this.getRequiredDependency("versionApiHandler");

    return {
      name: "version",
      description: "版本信息相关 API",
      path: "/api/version",
      routes: [
        {
          method: "GET",
          path: "",
          handler: (c) => handler.getVersion(c),
        },
        {
          method: "GET",
          path: "/simple",
          handler: (c) => handler.getVersionSimple(c),
        },
        {
          method: "GET",
          path: "/available",
          handler: (c) => handler.getAvailableVersions(c),
        },
        {
          method: "GET",
          path: "/latest",
          handler: (c) => handler.checkLatestVersion(c),
        },
        {
          method: "POST",
          path: "/cache/clear",
          handler: (c) => handler.clearVersionCache(c),
        },
      ],
    };
  }
}
