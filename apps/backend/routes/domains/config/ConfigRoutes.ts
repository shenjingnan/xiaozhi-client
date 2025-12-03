/**
 * 配置管理路由模块
 * 处理所有配置相关的 API 路由
 */

import { BaseRoute } from "../../BaseRoute.js";
import type { RouteDomainConfig } from "../../types.js";

/**
 * 配置管理路由类
 * 负责注册配置相关的所有 API 路由
 */
export class ConfigRoutes extends BaseRoute {
  /**
   * 获取配置路由域配置
   * @returns 路由域配置
   */
  getRouteConfig(): RouteDomainConfig {
    const handler = this.getRequiredDependency("configApiHandler");

    return {
      name: "config",
      description: "配置管理相关 API",
      path: "/api/config",
      routes: [
        {
          method: "GET",
          path: "",
          handler: (c) => handler.getConfig(c),
        },
        {
          method: "PUT",
          path: "",
          handler: (c) => handler.updateConfig(c),
        },
        {
          method: "GET",
          path: "/mcp-endpoint",
          handler: (c) => handler.getMcpEndpoint(c),
        },
        {
          method: "GET",
          path: "/mcp-endpoints",
          handler: (c) => handler.getMcpEndpoints(c),
        },
        {
          method: "GET",
          path: "/mcp-servers",
          handler: (c) => handler.getMcpServers(c),
        },
        {
          method: "GET",
          path: "/connection",
          handler: (c) => handler.getConnectionConfig(c),
        },
        {
          method: "POST",
          path: "/reload",
          handler: (c) => handler.reloadConfig(c),
        },
        {
          method: "GET",
          path: "/path",
          handler: (c) => handler.getConfigPath(c),
        },
        {
          method: "GET",
          path: "/exists",
          handler: (c) => handler.checkConfigExists(c),
        },
      ],
    };
  }
}
