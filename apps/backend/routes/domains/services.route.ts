/**
 * 服务管理路由配置
 * 处理所有服务管理相关的 API 路由
 */

import type { Context } from "hono";
import type { HandlerDependencies, RouteConfig } from "../types.js";

export const servicesRoutes: RouteConfig = {
  name: "services",
  path: "/api/services",
  description: "服务管理相关 API",
  routes: [
    {
      method: "POST",
      path: "/restart",
      handler: (c: Context) => {
        const { serviceApiHandler } = c.get(
          "dependencies"
        ) as HandlerDependencies;
        return serviceApiHandler.restartService(c);
      },
    },
    {
      method: "POST",
      path: "/stop",
      handler: (c: Context) => {
        const { serviceApiHandler } = c.get(
          "dependencies"
        ) as HandlerDependencies;
        return serviceApiHandler.stopService(c);
      },
    },
    {
      method: "POST",
      path: "/start",
      handler: (c: Context) => {
        const { serviceApiHandler } = c.get(
          "dependencies"
        ) as HandlerDependencies;
        return serviceApiHandler.startService(c);
      },
    },
    {
      method: "GET",
      path: "/status",
      handler: (c: Context) => {
        const { serviceApiHandler } = c.get(
          "dependencies"
        ) as HandlerDependencies;
        return serviceApiHandler.getServiceStatus(c);
      },
    },
    {
      method: "GET",
      path: "/health",
      handler: (c: Context) => {
        const { serviceApiHandler } = c.get(
          "dependencies"
        ) as HandlerDependencies;
        return serviceApiHandler.getServiceHealth(c);
      },
    },
  ],
};
