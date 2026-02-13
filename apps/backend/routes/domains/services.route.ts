/**
 * 服务管理路由配置
 * 处理所有服务管理相关的 API 路由
 */

import type { RouteDefinition } from "@/routes/types.js";
import { createHandler } from "@/routes/types.js";

const h = createHandler("serviceApiHandler");

export const servicesRoutes: RouteDefinition[] = [
  {
    method: "POST",
    path: "/api/services/restart",
    handler: h((handler, c) => handler.restartService(c)),
  },
  {
    method: "POST",
    path: "/api/services/stop",
    handler: h((handler, c) => handler.stopService(c)),
  },
  {
    method: "POST",
    path: "/api/services/start",
    handler: h((handler, c) => handler.startService(c)),
  },
  {
    method: "GET",
    path: "/api/services/status",
    handler: h((handler, c) => handler.getServiceStatus(c)),
  },
  {
    method: "GET",
    path: "/api/services/health",
    handler: h((handler, c) => handler.getServiceHealth(c)),
  },
];
