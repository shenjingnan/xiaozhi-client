/**
 * 静态文件路由模块
 * 处理静态文件服务相关的路由
 */

import { BaseRoute } from "../../BaseRoute.js";
import type { RouteDomainConfig } from "../../types.js";

/**
 * 静态文件路由类
 * 负责注册静态文件服务相关的路由
 */
export class StaticRoutes extends BaseRoute {
  /**
   * 获取静态文件路由域配置
   * @returns 路由域配置
   */
  getRouteConfig(): RouteDomainConfig {
    const handler = this.getRequiredDependency("staticFileHandler");

    return {
      name: "static",
      description: "静态文件服务路由",
      path: "",
      routes: [
        {
          method: "GET",
          path: "*",
          handler: (c) => handler.handleStaticFile(c),
        },
      ],
    };
  }
}
