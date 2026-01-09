/**
 * 服务管理路由配置
 * 处理所有服务管理相关的 API 路由
 */

import type { RouteDefinition } from "../types.js";
import { createHandler } from "../types.js";

const h = createHandler("serviceApiHandler");

export const servicesRoutes: RouteDefinition[] = [
  {
    method: "POST",
    path: "/api/services/restart",
    name: "services-restart",
    handler: h((handler, c) => handler.restartService(c)),
  },
  {
    method: "POST",
    path: "/api/services/stop",
    name: "services-stop",
    handler: h((handler, c) => handler.stopService(c)),
  },
  {
    method: "POST",
    path: "/api/services/start",
    name: "services-start",
    handler: h((handler, c) => handler.startService(c)),
  },
  {
    method: "GET",
    path: "/api/services/status",
    name: "services-status",
    handler: h((handler, c) => handler.getServiceStatus(c)),
  },
  {
    method: "GET",
    path: "/api/services/health",
    name: "services-health",
    handler: h((handler, c) => handler.getServiceHealth(c)),
  },
];
