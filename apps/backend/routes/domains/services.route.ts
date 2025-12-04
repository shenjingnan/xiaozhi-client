/**
 * 服务管理路由配置
 * 处理所有服务管理相关的 API 路由
 */

import type { Context } from "hono";
import type { SimpleRouteConfig } from "../types.js";

export const servicesRoutes: SimpleRouteConfig = {
  name: "services",
  path: "/api/services",
  description: "服务管理相关 API",
  routes: [
    {
      method: "POST",
      path: "/restart",
      handler: (c: Context) => {
        const handler = c.get("serviceApiHandler");
        return handler.restartService(c);
      },
    },
    {
      method: "POST",
      path: "/stop",
      handler: (c: Context) => {
        const handler = c.get("serviceApiHandler");
        return handler.stopService(c);
      },
    },
    {
      method: "POST",
      path: "/start",
      handler: (c: Context) => {
        const handler = c.get("serviceApiHandler");
        return handler.startService(c);
      },
    },
    {
      method: "GET",
      path: "/status",
      handler: (c: Context) => {
        const handler = c.get("serviceApiHandler");
        return handler.getServiceStatus(c);
      },
    },
    {
      method: "GET",
      path: "/health",
      handler: (c: Context) => {
        const handler = c.get("serviceApiHandler");
        return handler.getServiceHealth(c);
      },
    },
  ],
};
