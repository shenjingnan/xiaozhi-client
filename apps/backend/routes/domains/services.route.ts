/**
 * 服务管理路由配置
 * 处理所有服务管理相关的 API 路由
 */

import type { Context } from "hono";
import type { HandlerDependencies, RouteDefinition } from "../types.js";

export const servicesRoutes: RouteDefinition[] = [
  {
    method: "POST",
    path: "/api/services/restart",
    name: "services-restart",
    handler: (c: Context) => {
      const { serviceApiHandler } = c.get(
        "dependencies"
      ) as HandlerDependencies;
      return serviceApiHandler.restartService(c);
    },
  },
  {
    method: "POST",
    path: "/api/services/stop",
    name: "services-stop",
    handler: (c: Context) => {
      const { serviceApiHandler } = c.get(
        "dependencies"
      ) as HandlerDependencies;
      return serviceApiHandler.stopService(c);
    },
  },
  {
    method: "POST",
    path: "/api/services/start",
    name: "services-start",
    handler: (c: Context) => {
      const { serviceApiHandler } = c.get(
        "dependencies"
      ) as HandlerDependencies;
      return serviceApiHandler.startService(c);
    },
  },
  {
    method: "GET",
    path: "/api/services/status",
    name: "services-status",
    handler: (c: Context) => {
      const { serviceApiHandler } = c.get(
        "dependencies"
      ) as HandlerDependencies;
      return serviceApiHandler.getServiceStatus(c);
    },
  },
  {
    method: "GET",
    path: "/api/services/health",
    name: "services-health",
    handler: (c: Context) => {
      const { serviceApiHandler } = c.get(
        "dependencies"
      ) as HandlerDependencies;
      return serviceApiHandler.getServiceHealth(c);
    },
  },
];
